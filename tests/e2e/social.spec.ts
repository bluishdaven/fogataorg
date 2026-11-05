import { expect, test, type Page } from "@playwright/test";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function usernameOf(page: Page): Promise<string> {
  await page.getByTestId("account-menu").click();
  const handle = (await page.getByText(/^@e2e[a-z0-9_]+$/).textContent())!.slice(1);
  await page.keyboard.press("Escape");
  return handle;
}

test("readers spark, save, follow and respond; writers get grouped notifications and can pin", async ({ browser }) => {
  test.setTimeout(120_000);
  const writerContext = await browser.newContext();
  const readerContext = await browser.newContext();
  const writer = await writerContext.newPage();
  const reader = await readerContext.newPage();

  await signInWithMagicLink(writer, "en");
  const writerHandle = await usernameOf(writer);
  const title = `Social ember ${Date.now()}`;
  const storyUrl = await publishStory(writer, title);

  await signInWithMagicLink(reader, "en");
  await reader.goto(storyUrl);

  // Sparks: three taps, saved as one total.
  const spark = reader.getByTestId("spark-button");
  await spark.click();
  await spark.click();
  await spark.click();
  await expect(reader.getByTestId("spark-total")).toContainText("3 sparks");
  await reader.waitForTimeout(1200);
  await reader.reload();
  await expect(reader.getByTestId("spark-total")).toContainText("3 sparks");

  // Save for later.
  await reader.getByTestId("save-button").click();
  await expect(reader.getByTestId("save-button")).toHaveAttribute("aria-pressed", "true");

  // Follow the writer.
  await reader.getByRole("complementary", { name: "About the writer" }).getByTestId("follow-button").click();
  await expect(reader.getByRole("complementary", { name: "About the writer" })).toContainText("1 follower");

  // Respond, mentioning the writer.
  await reader.getByLabel("Your response").fill(`Loved the tamales. @${writerHandle} more of this please.`);
  await reader.getByRole("button", { name: "Respond", exact: true }).click();
  const response = reader.getByTestId("response").filter({ hasText: "Loved the tamales." });
  await expect(response).toBeVisible();
  await expect(response.getByRole("link", { name: `@${writerHandle}` })).toHaveAttribute("href", `/@${writerHandle}`);

  // The saved list has the story.
  await reader.goto("/en/me/saved");
  await expect(reader.getByTestId("saved-list").getByRole("link", { name: title })).toBeVisible();

  // The writer sees grouped notifications.
  await writer.goto("/en");
  await expect(writer.getByTestId("notification-count")).toBeVisible();
  await writer.getByTestId("notification-bell").click();
  const list = writer.getByTestId("notifications-list");
  await expect(list).toContainText(`sparked your story “${title}”`);
  await expect(list).toContainText(`responded to “${title}”`);
  await expect(list).toContainText(`mentioned you on “${title}”`);
  await expect(list).toContainText("started following you");

  // Writer replies and pins the response.
  await writer.goto(storyUrl);
  const writerView = writer.getByTestId("response").filter({ hasText: "Loved the tamales." });
  await writerView.getByRole("button", { name: "Pin" }).click();
  await expect(writerView).toContainText("Pinned by the writer");
  await writer.getByRole("button", { name: "Reply" }).first().click();
  await writer.getByLabel("Your reply").fill("Thank you for reading!");
  await writer.getByRole("button", { name: "Reply", exact: true }).last().click();
  await expect(writer.getByTestId("response").filter({ hasText: "Thank you for reading!" })).toContainText("Writer");

  await reader.goto(storyUrl);
  await expect(reader.getByTestId("response").filter({ hasText: "Loved the tamales." })).toContainText("Pinned by the writer");

  await deleteFromMyStories(writer, title);
  await writerContext.close();
  await readerContext.close();
});

test("signed-out readers are sent to sign in when they spark", async ({ page }) => {
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await page.getByTestId("spark-button").click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2F%40danawrites/);
});

test("readers can respond to a single paragraph", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto("/@danawrites/notes-from-a-river-that-changed-course");
  const paragraph = page.locator("#story-body p[data-block]").nth(1);
  await paragraph.scrollIntoViewIfNeeded();
  await paragraph.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el.firstChild!);
    range.setEnd(el.firstChild!, Math.min(20, el.firstChild!.textContent!.length));
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.getByTestId("respond-to-selection").click();
  await expect(page.getByText("Responding to this paragraph")).toBeVisible();
  const note = `Paragraph note ${Date.now()}`;
  await page.getByLabel("Your response").fill(note);
  await page.getByRole("button", { name: "Respond", exact: true }).click();
  const posted = page.getByTestId("response").filter({ hasText: note });
  await expect(posted.locator("blockquote")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("paragraph-marker").first()).toBeVisible();

  // Clean up.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("response").filter({ hasText: note }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("response").filter({ hasText: note })).toHaveCount(0);
});

test("search finds stories without accents, people and topics", async ({ page }) => {
  await page.goto("/en");
  await page.getByTestId("search-button").click();
  await expect(page).toHaveURL(/\/en\/search$/);
  await page.getByTestId("search-input").fill("libreria");
  await page.getByTestId("search-input").press("Enter");
  await expect(page.getByTestId("search-stories").getByRole("link", { name: "La librería cierra a las ocho" })).toBeVisible();

  await page.goto("/es/search?q=luci");
  await expect(page.getByTestId("search-people")).toContainText("Lucía Ortega");

  await page.goto("/en/search?q=herron&lang=en");
  await expect(page.getByTestId("search-stories").getByRole("link", { name: "The heron knows something I don't" })).toBeVisible();
});

test("pressing / opens search", async ({ page }) => {
  await page.goto("/en/topics");
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/en\/search$/);
  await expect(page.getByTestId("search-input")).toBeFocused();
});
