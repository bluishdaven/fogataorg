import { expect, test, type Page } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

const STORY = "/@danawrites/the-heron-knows-something-i-dont";
const TITLE = "The heron knows something I don't";

/** Scrolls so the bottom of the window sits about halfway through the story. */
async function readHalfway(page: Page) {
  await page.evaluate(() => {
    const story = document.getElementById("story")!;
    const rect = story.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + rect.top + rect.height * 0.5 - window.innerHeight);
  });
  await page.waitForTimeout(600);
}

test.use({ viewport: { width: 420, height: 700 } });

test("signed-in readers pick up where they left off, from the home page or the story", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  await readHalfway(page);
  // Leaving the page sends the reader's place.
  await page.goto("/en");
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("continue-reading")).toContainText(TITLE, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId("continue-reading")).toContainText(/\d+% read/);

  await page.getByTestId("continue-reading").getByRole("link", { name: new RegExp(TITLE) }).click();
  await expect(page).toHaveURL(/#p-[0-9a-f-]{36}$/);

  // Coming back to the top of the story offers to jump.
  await page.goto(STORY);
  const pill = page.getByTestId("resume-reading");
  await expect(pill).toContainText(/Pick up where you left off \(\d+%\)/);
  await pill.getByRole("button", { name: /Pick up where you left off/ }).click();
  await expect(pill).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
});

test("visitors' place stays in their browser", async ({ page }) => {
  await page.goto(STORY);
  await readHalfway(page);
  await page.goto("/en/topics");
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("fogata:positions") ?? "{}")).length)).toBe(1);
  await page.goto(STORY);
  await expect(page.getByTestId("resume-reading")).toBeVisible();
  await page.getByTestId("resume-reading").getByRole("button", { name: "Start from the top" }).click();
  await expect(page.getByTestId("resume-reading")).toHaveCount(0);
});
