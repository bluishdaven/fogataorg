import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { signInWithMagicLink } from "./sign-in";

/** Local test database only: marks an account as the owner (what the Supabase dashboard does in production). */
async function setAdmin(email: string, admin: boolean) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      update auth.users
      set raw_app_meta_data = case when ${admin} then raw_app_meta_data || '{"role":"admin"}'::jsonb
                                   else raw_app_meta_data - 'role' end
      where email = ${email}`;
  } finally {
    await sql.end();
  }
}

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
    await setAdmin(ownerEmail, true);
    // The role travels in the session token, so sign in again to pick it up.
    await owner.getByTestId("account-menu").click();
    await owner.getByTestId("sign-out").click();
    await signInWithMagicLink(owner, "en", ownerEmail);

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
    await expect(owner.getByTestId("donor-message")).toContainText("is now a Firekeeper.");
    const grant = owner.getByTestId("donor-grant").filter({ hasText: `@${donorUsername}` });
    await expect(grant).toContainText("BMC test receipt");

    // Everyone sees it on the donor's profile.
    await donor.goto(`/@${donorUsername}`);
    await expect(donor.getByRole("main").locator('[data-badge="donor"]')).toContainText("Firekeeper");

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
