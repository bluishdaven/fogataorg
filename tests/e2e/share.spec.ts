import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

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
  const downloading = page.waitForEvent("download");
  await page.getByTestId("share-stories").click();
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
