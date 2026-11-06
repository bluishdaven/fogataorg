import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function fetchShareImage(page: Page) {
  const content = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(content).toBeTruthy();
  const url = new URL(content!);
  const response = await page.request.get(url.pathname + url.search);
  return { url, status: response.status(), type: response.headers()["content-type"] };
}

test("people add pronouns, what they're into and their influences; profiles show them with a word count", async ({ page }) => {
  test.setTimeout(120_000);
  await signInWithMagicLink(page, "en");
  const stamp = Date.now();
  const title = `Counting words ${stamp}`;
  // Unique per run, so searching for it finds this person among everyone earlier runs created.
  const book = `Libro de prueba ${stamp}`;
  await publishStory(page, title);

  await page.goto("/en/settings/profile");
  await page.getByLabel("Pronouns (optional)").fill("they/them");
  await page.getByText("Watching", { exact: true }).click();
  await page.getByLabel("What are you watching?").fill("Perfect Days");
  await page.getByLabel("Books").fill(`Pedro Páramo\n\n${book}\npedro páramo`);
  await page.getByLabel("Politics").fill("Social democracy");
  expect(await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze().then((r) =>
    r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
  )).toEqual([]);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();

  // Saved as entered (blank lines and repeats dropped), and shown on the profile.
  await page.reload();
  await expect(page.getByLabel("Books")).toHaveValue(`Pedro Páramo\n${book}`);
  const username = await page.getByLabel("Username").inputValue();
  await page.goto(`/@${username}`);
  await expect(page.getByTestId("profile-pronouns")).toHaveText("they/them");
  await expect(page.getByTestId("now-line")).toHaveText("Now watching: Perfect Days");
  const influences = page.getByTestId("profile-influences");
  await expect(influences.getByRole("listitem")).toHaveText(["Pedro Páramo", book, "Social democracy"]);
  // Pronouns follow the name in story bylines too.
  await expect(page.getByRole("article").filter({ hasText: title }).getByTestId("byline-pronouns")).toHaveText("they/them");
  await expect(page.getByTestId("profile-word-count")).toHaveText(/^\d+ words$/);
  await expect(page.getByRole("main")).toContainText("1 story · ");
  expect(await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze().then((r) =>
    r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
  )).toEqual([]);

  // Profile previews: a card with photo or initials, name, bio and counts.
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /1 story · \d+ words/);
  const profileImage = await fetchShareImage(page);
  expect(profileImage.url.pathname).toBe(`/api/og/profile/${username}`);
  expect(profileImage).toMatchObject({ status: 200, type: "image/png" });

  // A story without a picture gets a card with its title.
  await page.getByRole("link", { name: title }).click();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
  await expect(page.locator("#story-header").getByTestId("byline-pronouns")).toHaveText("they/them");
  // The writer card shows pronouns and what they're into.
  const writerCard = page.getByRole("complementary", { name: "About the writer" });
  await expect(writerCard.getByTestId("author-pronouns")).toContainText("they/them");
  await expect(writerCard.getByTestId("now-line")).toHaveText("Now watching: Perfect Days");
  const storyImage = await fetchShareImage(page);
  expect(storyImage.url.pathname).toMatch(/^\/api\/og\/story\//);
  expect(storyImage).toMatchObject({ status: 200, type: "image/png" });

  // Responses carry pronouns too, right away and after a reload.
  await page.getByLabel("Your response").fill("A note to myself about counting.");
  await page.getByRole("button", { name: "Respond", exact: true }).click();
  const response = page.getByTestId("response").filter({ hasText: "A note to myself about counting." });
  await expect(response.getByTestId("response-pronouns")).toHaveText("they/them");
  await page.reload();
  await expect(response.getByTestId("response-pronouns")).toHaveText("they/them");

  // Influences are searchable (accents optional) and the result says which one matched.
  await page.goto(`/en/search?q=${encodeURIComponent(book.replace("Libro", "libro"))}`);
  const person = page.getByTestId("search-people").getByRole("listitem").filter({ hasText: `@${username}` });
  await expect(person.getByTestId("search-influence")).toHaveText(`Books: ${book}`);
  await expect(person).toContainText("they/them");
});

test("the general link previews with the flame card, in the page's language", async ({ page }) => {
  await page.goto("/es");
  const image = await fetchShareImage(page);
  expect(image.url.pathname + image.url.search).toBe("/api/og/site?locale=es");
  expect(image).toMatchObject({ status: 200, type: "image/png" });
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});
