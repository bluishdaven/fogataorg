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
  const title = `Counting words ${Date.now()}`;
  await publishStory(page, title);

  await page.goto("/en/settings/profile");
  await page.getByLabel("Pronouns (optional)").fill("they/them");
  await page.getByText("Watching", { exact: true }).click();
  await page.getByLabel("What are you watching?").fill("Perfect Days");
  await page.getByLabel("Books").fill("Pedro Páramo\n\nRayuela\npedro páramo");
  await page.getByLabel("Politics").fill("Social democracy");
  expect(await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze().then((r) =>
    r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
  )).toEqual([]);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();

  // Saved as entered (blank lines and repeats dropped), and shown on the profile.
  await page.reload();
  await expect(page.getByLabel("Books")).toHaveValue("Pedro Páramo\nRayuela");
  const username = await page.getByLabel("Username").inputValue();
  await page.goto(`/@${username}`);
  await expect(page.getByTestId("profile-pronouns")).toHaveText("they/them");
  await expect(page.getByTestId("profile-now")).toHaveText("Now watching: Perfect Days");
  const influences = page.getByTestId("profile-influences");
  await expect(influences.getByRole("listitem")).toHaveText(["Pedro Páramo", "Rayuela", "Social democracy"]);
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
  await expect(page.getByTestId("author-pronouns")).toContainText("they/them");
  const storyImage = await fetchShareImage(page);
  expect(storyImage.url.pathname).toMatch(/^\/api\/og\/story\//);
  expect(storyImage).toMatchObject({ status: 200, type: "image/png" });
});

test("the general link previews with the flame card, in the page's language", async ({ page }) => {
  await page.goto("/es");
  const image = await fetchShareImage(page);
  expect(image.url.pathname + image.url.search).toBe("/api/og/site?locale=es");
  expect(image).toMatchObject({ status: 200, type: "image/png" });
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});
