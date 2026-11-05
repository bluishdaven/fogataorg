import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { becomeAdmin, setAdmin } from "./admin";
import { publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function usernameOf(page: Page) {
  await page.goto("/en/settings/profile");
  return page.getByLabel("Username").inputValue();
}

test("writers' tiers show next to their names, in the reader's language", async ({ page, context, baseURL }) => {
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  const byline = page.locator("#story > header");
  await expect(byline.getByRole("img", { name: /^Kindling: first published story$|^Candle: 5\+ published stories$/ })).toBeVisible();

  await page.goto("/en");
  await expect(page.getByTestId("story-list").getByTestId("user-badges").first()).toBeVisible();

  await context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL! }]);
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await expect(
    page.locator("#story > header").getByRole("img", { name: /^(Yesca: primera historia publicada|Vela: 5\+ historias publicadas)$/ }),
  ).toBeVisible();
});

test("the owner grants and removes the donor badge", async ({ browser }) => {
  test.setTimeout(120_000);
  const donorContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const donor = await donorContext.newPage();
  const owner = await ownerContext.newPage();

  await signInWithMagicLink(donor, "en");
  const donorUsername = await usernameOf(donor);

  const ownerEmail = await signInWithMagicLink(owner, "en");
  // Not the owner yet: the admin page doesn't exist for them.
  await owner.goto("/en/admin/donors");
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");

  try {
    await becomeAdmin(owner, ownerEmail);

    await owner.getByTestId("account-menu").click();
    await owner.getByTestId("admin-donors-link").click();
    await expect(owner.getByRole("heading", { level: 1 })).toHaveText("Firekeepers");
    const results = await new AxeBuilder({ page: owner }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    // Unknown accounts are reported, not guessed.
    await owner.getByLabel("Username or email").fill("@nobody_by_this_name");
    await owner.getByTestId("grant-donor").click();
    await expect(owner.getByTestId("donor-message")).toHaveText("No account has that username or email.");

    await owner.getByLabel("Username or email").fill(`@${donorUsername}`);
    await owner.getByLabel("Private note").fill("BMC test receipt");
    await owner.getByTestId("grant-donor").click();
    await expect(owner.getByTestId("donor-message")).toContainText(/is a Firekeeper until /);
    const grant = owner.getByTestId("donor-grant").filter({ hasText: `@${donorUsername}` });
    await expect(grant).toContainText("BMC test receipt");
    await expect(grant).toContainText("active until");

    // Everyone sees it on the donor's profile.
    await donor.goto(`/@${donorUsername}`);
    await expect(donor.getByRole("main").locator('[data-badge="donor"]')).toContainText("Firekeeper");

    // The donor gets a thank-you in the bell.
    await expect(donor.getByTestId("notification-count")).toBeVisible();
    await donor.getByTestId("notification-bell").click();
    await expect(donor.getByTestId("notifications-list")).toContainText("You're a Firekeeper! Thank you for supporting Fogata");

    owner.once("dialog", (dialog) => void dialog.accept());
    await grant.getByTestId("remove-donor").click();
    await expect(grant).toContainText("removed");
    await donor.goto(`/@${donorUsername}`);
    await expect(donor.getByRole("main").locator('[data-badge="donor"]')).toHaveCount(0);
  } finally {
    await setAdmin(ownerEmail, false);
    await donorContext.close();
    await ownerContext.close();
  }
});

test("a writer's first story earns a badge, announced in the bell", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  await publishStory(page, `First light ${Date.now()}`);

  await expect(page.getByTestId("notification-count")).toHaveText("1");
  await page.getByTestId("notification-bell").click();
  const notice = page.getByTestId("notification").filter({ hasText: "Kindling" });
  await expect(notice).toHaveText(/You earned the Kindling badge: your first published story/);
  // It opens the writer's profile, where the badge shows.
  await notice.click();
  await expect(page.getByRole("main").locator('li[data-badge="kindling"]')).toContainText("Kindling");
});
