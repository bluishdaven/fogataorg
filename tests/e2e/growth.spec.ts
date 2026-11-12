import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { closePublishedMoment, deleteFromMyStories, startDraft, waitSaved, writeStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function noSeriousViolations(page: Page) {
  // Let the entrance animations (tiles rising in, counters) finish; the drifting embers never do.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished)),
  );
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

test("a first publish opens its live moment; readers get an invitation, RSS and an embed; the writer sees stats", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `Kindling ${Date.now()}`;
  await writeStory(page, title);
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();

  // The moment it goes live (over the story): ways to share it, and a way to its stats.
  const moment = page.getByTestId("published-moment");
  await expect(moment).toContainText("Your story is live");
  await expect(moment.getByTestId("published-whatsapp")).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // Only once: reloading doesn't bring it back.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByTestId("published-moment")).toHaveCount(0);

  const storyUrl = page.url();
  const [, handle, slug] = new URL(storyUrl).pathname.match(/^\/@([^/]+)\/(.+)$/) ?? [];
  expect(handle && slug).toBeTruthy();
  await page.getByTestId("share-button").click();
  await expect(page.getByTestId("share-embed")).toBeVisible();
  await page.keyboard.press("Escape");

  // A visitor: the invitation, and a read past half the story.
  const visitor = await browser.newContext();
  const reader = await visitor.newPage();
  await reader.goto(storyUrl);
  const invitation = reader.getByTestId("join-invitation");
  await expect(invitation).toContainText("Pull up a seat by the fire");
  await expect(invitation.getByTestId("join-cta")).toHaveAttribute("href", new RegExp(`/en/login\\?next=${encodeURIComponent(`/@${handle}/${slug}`)}`));
  await noSeriousViolations(reader);
  await reader.mouse.wheel(0, 20_000);
  await reader.waitForTimeout(500);
  await visitor.close();

  // RSS and the embed card.
  const rss = await page.request.get(`/rss/@${handle}.xml`);
  expect(rss.status()).toBe(200);
  expect(rss.headers()["content-type"]).toContain("application/rss+xml");
  expect(await rss.text()).toContain(`<title>${title}</title>`);
  const embed = await page.request.get(`/embed/${handle}/${slug}`);
  expect(embed.status()).toBe(200);
  expect(embed.headers()["x-frame-options"]).toBeUndefined();
  expect(embed.headers()["content-security-policy"]).toContain("frame-ancestors *");
  const html = await embed.text();
  expect(html).toContain(title);
  expect(html).toContain("Read on Fogata");
  expect((await page.request.get("/en")).headers()["x-frame-options"]).toBe("SAMEORIGIN");

  // The writer's stats count that read (totals only).
  await page.getByTestId("account-menu").click();
  await page.getByTestId("stats-link").click();
  await expect(page).toHaveURL(/\/en\/me\/stats$/);
  await expect(page.getByTestId("stats-tiles")).toBeVisible();
  await page.getByTestId("stats-story").filter({ hasText: title }).getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(/\/en\/me\/stats\/[0-9a-f-]{36}$/);
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("story-stat-views")).toContainText(/[1-9]/, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByTestId("read-depth")).toBeVisible();
  await expect(page.getByTestId("story-reads-chart")).toBeVisible();
  // The chart's numbers are reachable by keyboard.
  await page.getByTestId("story-reads-chart-plot").focus();
  await expect(page.getByTestId("story-reads-chart-tooltip")).toBeVisible();
  await noSeriousViolations(page);

  await deleteFromMyStories(page, title);
});
