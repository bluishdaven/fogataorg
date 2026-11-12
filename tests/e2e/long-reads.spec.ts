import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BODY, closePublishedMoment, publishStory, startDraft, waitSaved, writeStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

const seriousViolations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => v.id);

test("writers group stories into a series; readers follow the parts in order", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithMagicLink(page, "en");
  const stamp = Date.now();
  const first = `First night ${stamp}`;
  const second = `Second night ${stamp}`;
  const firstUrl = new URL(await publishStory(page, first));
  await publishStory(page, second);
  const handle = firstUrl.pathname.split("/")[1]!.slice(1);

  await page.goto("/en/me/stories");
  await page.getByTestId("series-link").click();
  await expect(page).toHaveURL(/\/en\/me\/series$/);
  const form = page.getByTestId("new-series");
  await form.getByLabel("Title").fill(`Nights by the water ${stamp}`);
  await form.getByLabel("Short description (optional)").fill("Two nights, one fire.");
  await form.getByRole("button", { name: "Create series" }).click();
  const card = page.getByTestId("my-series").filter({ hasText: `Nights by the water ${stamp}` });
  await expect(card).toBeVisible();

  for (const title of [first, second]) {
    await card.getByTestId("add-to-series").selectOption({ label: title });
    await card.getByTestId("add-to-series-submit").click();
    await expect(card.getByTestId("series-parts")).toContainText(title);
  }
  const parts = card.getByTestId("series-parts").getByRole("listitem");
  await expect(parts).toHaveText([new RegExp(first), new RegExp(second)]);
  await card.getByRole("button", { name: `Move ${second} up` }).click();
  await expect(parts).toHaveText([new RegExp(second), new RegExp(first)]);
  await card.getByRole("button", { name: `Move ${second} down` }).click();
  await expect(parts).toHaveText([new RegExp(first), new RegExp(second)]);
  // The title streams in with the page; wait for it before checking accessibility.
  await expect(page).toHaveTitle(/Your series/);
  expect(await seriousViolations(page)).toEqual([]);

  // The first part says where it is and leads to the next.
  await page.goto(firstUrl.pathname);
  const box = page.getByTestId("story-series");
  await expect(box).toContainText(`Part 1 of 2 in Nights by the water ${stamp}`);
  await expect(page.getByTestId("story-series-next")).toContainText(second);

  await box.getByRole("link", { name: `Nights by the water ${stamp}` }).click();
  await expect(page).toHaveURL(new RegExp(`/@${handle}/series/nights-by-the-water-${stamp}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Nights by the water ${stamp}`);
  const list = page.getByTestId("series-page-parts");
  await expect(list.getByRole("heading", { level: 2 })).toHaveText(["Part 1", "Part 2"]);
  await expect(list.getByRole("heading", { level: 3 })).toHaveText([first, second]);
  await expect(page).toHaveTitle(new RegExp(`Nights by the water ${stamp}`));
  expect(await seriousViolations(page)).toEqual([]);

  // On the writer's profile, and a missing series is a real 404.
  await page.goto(`/@${handle}`);
  await expect(page.getByTestId("profile-series")).toContainText("2 parts");
  expect((await page.goto(`/@${handle}/series/no-such-series`))?.status()).toBe(404);
});

test("stories with three or more sections get a table of contents", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `Three parts ${Date.now()}`;
  await writeStory(page, title);
  for (const heading of ["The shore", "The fire", "The morning"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.type("/head");
    await expect(page.getByTestId("slash-menu")).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.type(heading);
    await page.keyboard.press("Enter");
    await page.keyboard.type(BODY);
  }
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  const contents = page.getByTestId("story-contents");
  await contents.getByText("Contents").click();
  await expect(contents.getByRole("link")).toHaveText(["The shore", "The fire", "The morning"]);
  await contents.getByRole("link", { name: "The morning" }).click();
  await expect(page.locator("#story-body [data-block]:target")).toHaveText("The morning");
});

test("writers can bring back an earlier version", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const editorUrl = page.url();
  await writeStory(page, `Versions ${Date.now()}`);
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await expect(page.getByRole("article")).toContainText(BODY);

  // An edit to the live story, saved as unpublished changes…
  await page.goto(editorUrl);
  await page.getByTestId("editor-body").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Then the rain came.");
  await waitSaved(page);
  await expect(page.getByTestId("editor-body")).toContainText("Then the rain came.");

  // …taken back to the published version.
  await page.getByTestId("open-history").click();
  const dialog = page.getByTestId("history-dialog");
  const published = dialog.getByTestId("history-version").filter({ hasText: "Published" });
  await expect(published).toHaveCount(1);
  await published.click();
  await expect(dialog.getByTestId("history-preview")).toContainText(BODY);
  await expect(dialog.getByTestId("history-preview")).not.toContainText("Then the rain came.");
  // Let Restore finish fading in from disabled before checking contrast.
  await expect(dialog.getByTestId("restore-version")).toHaveCSS("opacity", "1");
  expect(await seriousViolations(page)).toEqual([]);
  page.once("dialog", (prompt) => void prompt.accept());
  await dialog.getByTestId("restore-version").click();
  await expect(page.getByTestId("editor-body")).toContainText(BODY);
  await expect(page.getByTestId("editor-body")).not.toContainText("Then the rain came.");
  // The replaced text stays in the history: first draft, published, the edit, the restored text.
  await page.getByTestId("open-history").click();
  await expect(page.getByTestId("history-dialog").getByTestId("history-version")).toHaveCount(4);
});
