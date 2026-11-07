import { expect, test } from "@playwright/test";
import { publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

test("missing people and stories answer with a real 404, in the reader's language", async ({ page }) => {
  const person = await page.goto("/@nobody_lives_here");
  expect(person?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");

  // A writer who exists, a story that doesn't.
  const story = await page.goto("/@marcusbell/no-such-story-here");
  expect(story?.status()).toBe(404);

  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "es", url: new URL(page.url()).origin }]);
  expect((await page.goto("/@nobody_lives_here"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aquí se pierde el rastro");

  // Real pages are untouched.
  expect((await page.goto("/@marcusbell/the-last-set-of-the-night"))?.status()).toBe(200);
  expect((await page.goto("/@marcusbell"))?.status()).toBe(200);
});

test("after a username change, old links lead to the new one", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  const title = `Old links still work ${Date.now()}`;
  const storyUrl = new URL(await publishStory(page, title));
  const [, oldHandle, slug] = storyUrl.pathname.match(/^\/@([^/]+)\/(.+)$/) ?? [];
  expect(oldHandle && slug).toBeTruthy();

  const newHandle = `moved_${Date.now().toString(36)}`;
  await page.goto("/en/settings/profile");
  await page.getByLabel("Username").fill(newHandle);
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();

  await page.goto(`/@${oldHandle}/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/@${newHandle}/${slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.goto(`/@${oldHandle}`);
  await expect(page).toHaveURL(new RegExp(`/@${newHandle}$`));
});
