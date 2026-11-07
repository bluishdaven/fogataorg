import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { signInWithMagicLink } from "./sign-in";

const seriousViolations = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => v.id);

test("new readers pick their languages, topics and writers, then land on their feed", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en", undefined, { onboarding: "keep" });
  await expect(page).toHaveURL(/\/en\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to the fire");
  expect(await seriousViolations(page)).toEqual([]);

  // English only.
  await page.getByRole("group", { name: "I read stories in" }).getByText("Español").click();
  await page.getByTestId("onboarding-continue").click();

  await expect(page).toHaveURL(/step=topics/);
  const continueButton = page.getByTestId("onboarding-continue");
  await expect(continueButton).toBeDisabled();
  const topics = page.getByTestId("topic-choices");
  for (const name of ["Nature", "Books", "Poetry"]) await topics.getByText(name, { exact: true }).click();
  await expect(page.getByText("3 topics picked")).toBeVisible();
  // Let the button finish fading in from disabled before checking contrast.
  await expect(continueButton).toBeEnabled();
  await expect(continueButton).toHaveCSS("opacity", "1");
  expect(await seriousViolations(page)).toEqual([]);
  await continueButton.click();

  await expect(page).toHaveURL(/step=writers/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writers you might like");
  const first = page.getByTestId("suggested-writers").getByTestId("follow-button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByTestId("onboarding-done").click();

  // Home, on For you; Following has the topics they picked.
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByTestId("feed-tabs").getByRole("link", { name: "For you" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("onboarding-nudge")).toHaveCount(0);
  await page.getByTestId("feed-tabs").getByRole("link", { name: "Following" }).click();
  await expect(page.getByTestId("story-list")).toHaveAttribute("data-feed", "following");
  await expect(page.getByTestId("story-list").getByRole("link", { name: "The heron knows something I don't" })).toBeVisible();

  // Signing in again goes straight to the site, and the choices can be changed from Settings.
  await page.goto("/en/settings/account");
  await page.getByTestId("change-feeds").click();
  await expect(page.getByRole("group", { name: "I read stories in" }).getByRole("checkbox", { name: "Español" })).not.toBeChecked();
  await expect(page.getByRole("group", { name: "I read stories in" }).getByRole("checkbox", { name: "English" })).toBeChecked();
});

test("visitors get Latest and Burning now, in their language", async ({ page }) => {
  await page.goto("/en");
  const tabs = page.getByTestId("feed-tabs").getByRole("link");
  await expect(tabs).toHaveText(["Latest", "Burning now"]);
  await expect(tabs.first()).toHaveAttribute("aria-current", "page");
  await tabs.nth(1).click();
  await expect(page).toHaveURL(/\/en\?feed=burning$/);
  await expect(page.getByTestId("story-list")).toHaveAttribute("data-feed", "burning");

  await page.goto("/es");
  await expect(page.getByTestId("feed-tabs").getByRole("link")).toHaveText(["Recientes", "Lo que arde"]);
  expect(await seriousViolations(page)).toEqual([]);
});

test("reading past half a story counts as a read, without cookies", async ({ page }) => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [{ now } = { now: new Date(0) }] = await sql<{ now: Date }[]>`select now()`;
    await page.goto("/@danawrites/the-heron-knows-something-i-dont");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => {
        const [row] = await sql<{ n: number }[]>`
          select count(*)::int as n from public.read_events re join public.stories s on s.id = re.story_id
          where s.slug = 'the-heron-knows-something-i-dont' and re.updated_at >= ${now} and re.read_ratio >= 0.5`;
        return row?.n ?? 0;
      }, { timeout: 10_000 })
      .toBeGreaterThan(0);
    // The visitor got no cookie for it.
    expect((await page.context().cookies()).map((cookie) => cookie.name).filter((name) => !name.startsWith("NEXT_LOCALE"))).toEqual([]);
  } finally {
    await sql.end();
  }
});
