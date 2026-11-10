import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

const STORY = "/@danawrites/the-heron-knows-something-i-dont";
const QUOTE = "It stands in the shallows on one leg";

/** Selects the first `length` characters of the story's second paragraph, like a reader would. */
async function selectPassage(page: Page, length = QUOTE.length) {
  await expect(async () => {
    await page.evaluate((count) => {
      const paragraph = document.querySelectorAll<HTMLElement>("#story-body [data-block]")[1]!;
      const text = [...paragraph.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, count);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    }, length);
    await expect(page.getByTestId("selection-toolbar")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

const emberTexts = (page: Page) =>
  page.evaluate(() => [...((CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get("ember") ?? [])].map((range) => range.toString()));

test("readers keep passages as embers, find them later and let them go", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  await selectPassage(page);
  await page.getByTestId("highlight-selection").click();
  await expect(page.getByText("Kept as an ember. Find it under Embers in your menu.")).toBeVisible();

  // Marked in the story after a reload too, and offered for removal when selected again.
  await page.reload();
  await expect.poll(() => emberTexts(page)).toEqual([QUOTE]);
  await selectPassage(page);
  await expect(page.getByTestId("unhighlight-selection")).toBeVisible();

  await page.getByTestId("account-menu").click();
  await page.getByTestId("embers-link").click();
  await expect(page).toHaveURL(/\/en\/me\/embers$/);
  const list = page.getByTestId("embers-list");
  await expect(list.getByRole("blockquote")).toHaveText(QUOTE);
  const link = list.getByRole("link", { name: "From The heron knows something I don't, by Dana Whitfield" });
  await expect(link).toHaveAttribute("href", /#p-[0-9a-f-]{36}:~:text=It%20stands%20in%20the%20shallows%20on%20one%20leg$/);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // The link opens the story at that paragraph.
  await link.click();
  await expect(page.locator("#story-body [data-block]:target")).toContainText(QUOTE);

  await page.goto("/en/me/embers");
  await page.getByTestId("remove-ember").click();
  await expect(page.getByText("No embers yet.")).toBeVisible();
});

test("a passage link and a quote card, with the link copied in the same tap", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(STORY);
  await selectPassage(page);
  await page.getByTestId("copy-passage").click();
  await expect(page.getByText("Link to this passage copied.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/@danawrites\/the-heron-knows-something-i-dont#p-[0-9a-f-]{36}:~:text=It%20stands/);

  // A quote card: a feed post by default, or a Story; the dialog shows a preview first.
  const quoteCard = async (format: "Post · 4:5" | "Story · 9:16", height: number) => {
    await selectPassage(page);
    await page.getByTestId("quote-card").click();
    const dialog = page.getByTestId("share-image-dialog");
    await expect(dialog.getByRole("heading", { name: "Quote card" })).toBeVisible();
    // No cover or story color on this story, so only the size can change.
    await expect(dialog.getByLabel("Include the cover")).toHaveCount(0);
    await dialog.getByText(format).click();
    await expect(dialog.getByRole("radio", { name: format })).toBeChecked();
    await expect.poll(() => dialog.getByTestId("share-image-preview").evaluate((img: HTMLImageElement) => img.naturalHeight)).toBe(height);
    const downloading = page.waitForEvent("download");
    await dialog.getByTestId("share-image-confirm").click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("fogata-quote-the-heron-knows-something-i-dont.png");
    // The newest message (the first card's can still be showing when the second is made).
    await expect(page.getByText("Quote card saved. The link to the passage is copied too.").last()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#p-[0-9a-f-]{36}:~:text=It%20stands/);
    const path = testInfo.outputPath(`quote-card-${height}.png`);
    await download.saveAs(path);
    const png = await readFile(path);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, height]);
    expect(png.length).toBeGreaterThan(30_000);
  };
  await quoteCard("Post · 4:5", 1350);
  await quoteCard("Story · 9:16", 1920);

  // Visitors who try to keep an ember are asked to sign in first.
  await selectPassage(page);
  await page.getByTestId("highlight-selection").click();
  await expect(page).toHaveURL(/\/en\/login\?next=/);
});
