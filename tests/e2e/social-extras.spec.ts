import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function usernameOf(page: Page): Promise<string> {
  await page.getByTestId("account-menu").click();
  const handle = (await page.getByText(/^@e2e[a-z0-9_]+$/).textContent())!.slice(1);
  await page.keyboard.press("Escape");
  return handle;
}

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

const STORY = "/@danawrites/the-heron-knows-something-i-dont";

test("readers can take their sparks back", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  const total = page.getByTestId("spark-total");
  await expect(total).toBeVisible();
  // Start from no sparks, whatever an earlier run left.
  if (await page.getByTestId("spark-undo").isVisible()) {
    await page.getByTestId("spark-undo").click();
    await expect(page.getByTestId("spark-undo")).toBeHidden();
  }
  const before = Number((await total.locator(".sr-only").textContent())!.match(/\d+/)?.[0] ?? 0);

  await page.getByTestId("spark-button").click();
  await page.getByTestId("spark-button").click();
  await expect(total).toContainText(`${before + 2} sparks`);
  await page.getByTestId("spark-undo").click();
  await expect(page.getByTestId("spark-undo")).toBeHidden();
  await expect(page.getByTestId("spark-button")).toBeFocused();

  await page.reload();
  await expect(total.locator(".sr-only")).toHaveText(before === 0 ? "No sparks yet" : new RegExp(`^${before} sparks?$`));
  await expect(page.getByTestId("spark-undo")).toBeHidden();
});

test("readers can edit their responses, which then show as edited", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  const text = `First thought ${Date.now()}`;
  await page.getByLabel("Your response").fill(text);
  await page.getByRole("button", { name: "Respond", exact: true }).click();
  const response = page.getByTestId("response").filter({ hasText: text });
  await expect(response).toBeVisible();
  await expect(response.getByTestId("response-edited")).toBeHidden();

  await response.getByRole("button", { name: "Edit" }).click();
  const field = response.getByLabel("Edit your response");
  await expect(field).toBeFocused();
  await field.fill(`${text}, on second thought`);
  await response.getByRole("button", { name: "Save" }).click();
  await expect(response).toContainText("on second thought");
  await expect(response.getByTestId("response-edited")).toHaveText("edited");
  await expect(response.getByRole("button", { name: "Edit" })).toBeFocused();

  await page.reload();
  const reloaded = page.getByTestId("response").filter({ hasText: `${text}, on second thought` });
  await expect(reloaded.getByTestId("response-edited")).toBeVisible();

  // Clean up.
  page.once("dialog", (dialog) => void dialog.accept());
  await reloaded.getByRole("button", { name: "Delete" }).click();
  await expect(reloaded).toBeHidden();
});

test("readers keep stories in reading lists, then rename and delete a list", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  const save = page.getByTestId("save-button");
  await save.click();
  const menu = page.getByTestId("save-menu");
  await expect(menu.getByRole("checkbox", { name: "Saved" })).toBeChecked();
  await expect(save).toHaveAttribute("data-saved", "true");

  // A new list from the menu holds the story too.
  const listName = `Train rides ${Date.now()}`;
  await menu.getByLabel("Name of the new list").fill(listName);
  await menu.getByRole("button", { name: "Create" }).click();
  await expect(menu.getByRole("checkbox", { name: listName })).toBeChecked();
  // Same name again explains the problem.
  await menu.getByLabel("Name of the new list").fill(listName.toUpperCase());
  await menu.getByRole("button", { name: "Create" }).click();
  await expect(menu.getByRole("alert")).toHaveText("You already have a list with that name.");

  // Out of Saved, still in the list: still saved.
  await menu.getByRole("checkbox", { name: "Saved" }).uncheck();
  await expect(save).toHaveAttribute("data-saved", "true");
  await menu.getByRole("button", { name: "Done" }).click();
  await expect(menu).toBeHidden();
  await expect(save).toBeFocused();

  await page.goto("/en/me/saved");
  const chips = page.getByTestId("reading-lists");
  await expect(chips.getByRole("link", { name: /^Saved/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Nothing saved yet.", { exact: false })).toBeVisible();
  await chips.getByRole("link", { name: new RegExp(listName) }).click();
  await expect(page.getByTestId("reading-list-name")).toHaveText(listName);
  await expect(page.getByTestId("saved-list").getByRole("link", { name: "The heron knows something I don't" })).toBeVisible();

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("List name").fill(`${listName} (slow)`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("reading-list-name")).toHaveText(`${listName} (slow)`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete list" }).click();
  await expect(page).toHaveURL(/\/en\/me\/saved$/);
  await expect(page.getByTestId("reading-lists")).toHaveCount(0);

  // Back on the story, nothing holds it any more.
  await page.goto(STORY);
  await expect(page.getByTestId("save-button")).toHaveAttribute("data-saved", "false");
});

test("writers mute and block people: responses fold away, blocked people can't respond", async ({ browser }) => {
  test.setTimeout(150_000);
  const writerContext = await browser.newContext();
  const pestContext = await browser.newContext();
  const writer = await writerContext.newPage();
  const pest = await pestContext.newPage();

  await signInWithMagicLink(writer, "en");
  const title = `Quiet please ${Date.now()}`;
  const storyUrl = await publishStory(writer, title);
  await signInWithMagicLink(pest, "en");
  const pestHandle = await usernameOf(pest);
  await pest.goto(storyUrl);
  await pest.getByLabel("Your response").fill("First! Read my stuff.");
  await pest.getByRole("button", { name: "Respond", exact: true }).click();
  await expect(pest.getByTestId("response").filter({ hasText: "First! Read my stuff." })).toBeVisible();

  // Mute from the profile menu.
  await writer.goto(`/@${pestHandle}`);
  await writer.getByTestId("block-menu").click();
  await writer.getByRole("menuitem", { name: "Mute" }).click();
  await expect(writer.getByTestId("block-state")).toHaveText("Muted");
  expect(await axeSerious(writer)).toEqual([]);

  // Their response is folded away on the writer's story, and can be shown.
  await writer.goto(storyUrl);
  const folded = writer.getByTestId("hidden-response");
  await expect(folded).toHaveText(/A response from someone you muted or blocked\./);
  await folded.getByRole("button", { name: "Show it" }).click();
  await expect(writer.getByTestId("response").filter({ hasText: "First! Read my stuff." })).toBeVisible();

  // Block: confirm first; then they can't respond or follow.
  await writer.goto(`/@${pestHandle}`);
  await writer.getByTestId("block-menu").click();
  await writer.getByRole("menuitem", { name: "Block" }).click();
  await expect(writer.getByRole("dialog")).toContainText("They aren't told");
  await writer.getByTestId("confirm-block").click();
  await expect(writer.getByTestId("block-state")).toHaveText("Blocked");
  await expect(writer.getByTestId("follow-button")).toHaveCount(0);

  await pest.reload();
  await pest.getByLabel("Your response").fill("Hello again?");
  await pest.getByRole("button", { name: "Respond", exact: true }).click();
  await expect(pest.getByTestId("response-form").getByRole("alert")).toBeVisible();
  await expect(pest.getByTestId("response").filter({ hasText: "Hello again?" })).toHaveCount(0);

  // Settings lists them, with a way back.
  await writer.goto("/en/settings/account");
  const row = writer.getByTestId("blocked-people").getByRole("listitem").filter({ hasText: `@${pestHandle}` });
  await expect(row).toContainText("Blocked");
  await row.getByRole("button", { name: "Unblock" }).click();
  await expect(writer.getByText("You haven't muted or blocked anyone.")).toBeVisible();

  await deleteFromMyStories(writer, title);
  await writerContext.close();
  await pestContext.close();
});
