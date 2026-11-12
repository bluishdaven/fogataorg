import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { closePublishedMoment, deleteFromMyStories, startDraft, waitSaved, writeStory } from "./helpers";
import { solidPng } from "./png";
import { signInWithMagicLink } from "./sign-in";

const STORY = "/@danawrites/the-heron-knows-something-i-dont";

test("readers can share a story: copy the link or open a network", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(STORY);
  const actions = page.getByTestId("story-actions");
  await actions.getByTestId("share-button").click();

  const whatsapp = page.getByTestId("share-whatsapp");
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent((await whatsapp.getAttribute("href"))!)).toContain(`${STORY}`);
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("share-email")).toHaveAttribute("href", /^mailto:\?subject=/);

  await page.getByTestId("share-copy").click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(new RegExp(`^https?://[^/]+${STORY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
});

test("the share menu speaks Spanish on Spanish pages", async ({ page, context, baseURL }) => {
  // Share URLs have no locale prefix; the NEXT_LOCALE cookie picks the interface language.
  await context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL! }]);
  await page.goto(STORY);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByTestId("story-actions").getByTestId("share-button").click();
  await expect(page.getByTestId("share-copy")).toHaveText("Copiar enlace");
  await expect(page.getByTestId("share-email")).toHaveText("Correo");
});

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buffer: Buffer): [number, number] {
  expect(buffer.subarray(1, 4).toString()).toBe("PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("readers can download a ready-to-post Stories image of the story, with its link copied", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(STORY);
  await page.getByTestId("story-actions").getByTestId("share-button").click();
  await page.getByTestId("share-stories").click();
  // A dialog with a live preview and options comes first.
  const dialog = page.getByTestId("share-image-dialog");
  await expect(dialog.getByTestId("share-image-preview")).toBeVisible();
  // No cover or story color here, so only the length can change.
  await expect(dialog.getByLabel("Include the cover")).toHaveCount(0);
  await expect(dialog.getByLabel("Use the story's color")).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "Medium" })).toBeChecked();
  const downloading = page.waitForEvent("download");
  await dialog.getByTestId("share-image-confirm").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("fogata-the-heron-knows-something-i-dont.png");
  await expect(page.getByText("Image saved and link copied. Add the image to your Story and paste the link into a link sticker.")).toBeVisible();
  // The link is on the clipboard, ready for the Story's link sticker.
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`${STORY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));

  const path = testInfo.outputPath("story-image.png");
  await download.saveAs(path);
  const png = await readFile(path);
  expect(pngSize(png)).toEqual([1080, 1920]);
  expect(png.length).toBeGreaterThan(40_000); // real content, not a blank canvas
});

test("circle pages share too, with a Stories image of the circle", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/circles/lake-notes");
  const share = page.getByTestId("circle-band").getByTestId("share-button");
  await expect(share).toHaveText("Share");
  await share.click();
  // The shared link has no language prefix, so each visitor lands in their own language.
  const whatsapp = page.getByTestId("share-whatsapp");
  expect(decodeURIComponent((await whatsapp.getAttribute("href"))!)).toMatch(/Lake Notes, a circle on Fogata https?:\/\/[^/]+\/circles\/lake-notes$/);

  await page.getByTestId("share-stories").click();
  const dialog = page.getByTestId("share-image-dialog");
  await expect(dialog.getByTestId("share-image-preview")).toBeVisible();
  const downloading = page.waitForEvent("download");
  await dialog.getByTestId("share-image-confirm").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("fogata-circle-lake-notes.png");
  await expect(page.getByText("Image saved and link copied.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https?:\/\/[^/]+\/circles\/lake-notes$/);

  const path = testInfo.outputPath("circle-image.png");
  await download.saveAs(path);
  const png = await readFile(path);
  expect(pngSize(png)).toEqual([1080, 1920]);
  expect(png.length).toBeGreaterThan(40_000);
});

/** Whether two colors match within a few steps (uploads are re-encoded as WebP, which shifts them slightly). */
const near = (actual: number[], expected: number[]) => actual.every((value, i) => Math.abs(value - expected[i]!) <= 4);

/** The color of one pixel of the dialog's preview image. */
function pixel(preview: Locator, x: number, y: number) {
  return preview.evaluate(
    async (img: HTMLImageElement, [px, py]) => {
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(px!, py!, 1, 1).data.slice(0, 3));
    },
    [x, y],
  );
}

test("writers give a story a color; its Stories image uses it, with the cover and a chosen length", async ({ page, context }, testInfo) => {
  test.setTimeout(150_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `A colored story ${Date.now()}`;
  await writeStory(page, title);
  await waitSaved(page);

  // Publish with a cover and the teal color.
  await page.getByTestId("open-publish").click();
  const publish = page.getByTestId("publish-dialog");
  await expect(publish.getByRole("button", { name: "No color: Fogata's own look" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("cover-input").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: solidPng(1600, 900, [20, 120, 200]) });
  await publish.getByLabel("Cover alt text").fill("A blue field");
  await publish.getByRole("button", { name: "Color #0f766e" }).click();
  await expect(publish.getByTestId("publish-preview")).toHaveCSS("background-color", "rgb(15, 118, 110)");
  await page.getByTestId("publish-submit").click();
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  // The story page shows its color as a thin line and in the reading progress bar.
  await expect(page.getByTestId("story-accent")).toHaveCSS("background-color", "rgb(15, 118, 110)");
  await expect(page.getByTestId("reading-progress")).toHaveCSS("background-color", "rgb(15, 118, 110)");

  // The image dialog: the story's color behind it, the cover near the top.
  await page.getByTestId("story-actions").getByTestId("share-button").click();
  await page.getByTestId("share-stories").click();
  const dialog = page.getByTestId("share-image-dialog");
  const preview = dialog.getByTestId("share-image-preview");
  await expect(preview).toBeVisible();
  await expect.poll(() => pixel(preview, 5, 5)).toEqual([15, 118, 110]);
  await expect.poll(async () => near(await pixel(preview, 540, 600), [20, 120, 200])).toBe(true);
  expect((await new AxeBuilder({ page }).include("[data-testid=share-image-dialog]").analyze()).violations.map((v) => v.id)).toEqual([]);

  // Without the cover, and without the color (Fogata's dark paper).
  await dialog.getByLabel("Include the cover").uncheck();
  await expect.poll(async () => near(await pixel(preview, 540, 600), [20, 120, 200])).toBe(false);
  await dialog.getByLabel("Use the story's color").uncheck();
  await expect.poll(() => pixel(preview, 5, 5)).toEqual([27, 24, 20]);
  await dialog.getByTitle("Long").click();
  await expect(dialog.getByRole("radio", { name: "Long" })).toBeChecked();

  const downloading = page.waitForEvent("download");
  await dialog.getByTestId("share-image-confirm").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^fogata-a-colored-story-\d+\.png$/);
  await expect(dialog).toBeHidden();
  const path = testInfo.outputPath("colored-story.png");
  await download.saveAs(path);
  expect(pngSize(await readFile(path))).toEqual([1080, 1920]);

  // Quote cards carry the color too, and can add the cover (off by default) and be Story-sized.
  await page.evaluate(() => {
    const paragraph = document.querySelector<HTMLElement>("#story-body [data-block]")!;
    const text = [...paragraph.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 30);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await page.getByTestId("quote-card").click();
  const quote = page.getByTestId("share-image-dialog");
  const quotePreview = quote.getByTestId("share-image-preview");
  await expect(quote.getByLabel("Include the cover")).not.toBeChecked();
  await expect(quote.getByLabel("Use the story's color")).toBeChecked();
  await expect.poll(() => pixel(quotePreview, 5, 5)).toEqual([15, 118, 110]);
  await quote.getByLabel("Include the cover").check();
  await expect.poll(async () => near(await pixel(quotePreview, 540, 400), [20, 120, 200])).toBe(true);
  await quote.getByText("Story · 9:16").click();
  await expect.poll(() => quotePreview.evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(1920);
  await expect.poll(async () => near(await pixel(quotePreview, 540, 600), [20, 120, 200])).toBe(true);
  await page.keyboard.press("Escape");

  await deleteFromMyStories(page, title);
});
