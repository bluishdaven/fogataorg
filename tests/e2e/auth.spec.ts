import { expect, test } from "@playwright/test";
import { waitForMagicLink } from "./mailpit";
import { signInWithMagicLink } from "./sign-in";

test("rejects an invalid email with a readable message", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  // Scope to main: Next's route announcer is also role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a valid email address.");
  await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
});

test("signs in with a magic link and signs out again", async ({ page }) => {
  await signInWithMagicLink(page, "es");
  await expect(page).toHaveURL(/\/es$/);
  await page.getByTestId("account-menu").click();
  // New accounts get a username derived from the email.
  await expect(page.getByText(/@e2e\d+/)).toBeVisible();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("sign-in-link")).toBeVisible();
});

test("magic links return to the page the reader came from", async ({ page }) => {
  const email = `e2e-next-${Date.now()}@fogata.test`;
  await page.goto("/en/login?next=%2Fen%2Fdesign");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link = await waitForMagicLink(email);
  expect(link).toContain("/auth/confirm?next=%2Fen%2Fdesign");
  await page.goto(link);
  await expect(page).toHaveURL(/\/en\/design$/);
});

test("an expired or reused link explains what happened", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email&next=%2Fen");
  await expect(page).toHaveURL(/\/en\/login\?error=link/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("That link didn't work");
});

test("rejects off-site redirects after sign-in", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=email&next=https%3A%2F%2Fevil.example");
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/en\/login/);
});
