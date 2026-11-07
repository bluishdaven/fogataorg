import { expect, test } from "@playwright/test";

test("terms, privacy and content policy are linked from the footer and sign-in, in both languages", async ({ page }) => {
  await page.goto("/en");
  const legal = page.getByRole("contentinfo").getByTestId("legal-links");
  await legal.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/en\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
  await expect(page.getByRole("heading", { level: 2, name: "What we don't do" })).toBeVisible();
  await expect(page.getByRole("link", { name: /hola@fogata\.org/ })).toHaveAttribute("href", "mailto:hola@fogata.org");

  await page.getByRole("navigation", { name: "Also read" }).getByRole("link", { name: "Content policy" }).click();
  await expect(page).toHaveURL(/\/en\/content-policy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Content policy");

  await page.goto("/es/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de uso");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/terms$/);

  // Signing in says what you agree to, with links.
  await page.goto("/es/login");
  await expect(page.getByRole("main").getByRole("link", { name: "Términos de uso" })).toHaveAttribute("href", "/es/terms");
  await expect(page.getByRole("main").getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute("href", "/es/privacy");
});
