import { expect, test } from "@playwright/test";

test("home renders without horizontal scrolling", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByTestId("story-list")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a story is readable on this viewport", async ({ page }) => {
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the footer links to donations in both languages", async ({ page }) => {
  await page.goto("/en");
  const en = page.getByRole("contentinfo").getByTestId("support-link");
  await expect(en).toHaveText("Keep the fire going on Buy Me a Coffee");
  await expect(en).toHaveAttribute("href", "https://buymeacoffee.com/fogataorg");
  await page.goto("/es");
  await expect(page.getByRole("contentinfo").getByTestId("support-link")).toHaveText(
    "Mantén viva la fogata en Buy Me a Coffee",
  );
});

test("the footer shows merch as coming soon, not clickable", async ({ page }) => {
  await page.goto("/en");
  const merch = page.getByRole("contentinfo").getByTestId("merch-soon");
  await expect(merch).toHaveText(/Merch\s*Coming soon/);
  await expect(merch).toBeDisabled();
  await page.goto("/es");
  await expect(page.getByRole("contentinfo").getByTestId("merch-soon")).toHaveText(/Merch\s*Próximamente/);
});
