import { expect, test } from "@playwright/test";

test("the footer links to the manifesto, signed by Fogata.org in both languages", async ({ page }) => {
  await page.goto("/en");
  // The header reads "Fogata.org", the .org quieter.
  await expect(page.getByTestId("wordmark-org")).toHaveText(".org");

  await page.getByRole("contentinfo").getByTestId("manifesto-link").click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Manifesto");
  await expect(page.getByRole("heading", { level: 2, name: /A \.org, not an ad network/ })).toBeVisible();
  await expect(page.getByTestId("manifesto-signature")).toHaveText("— Fogata.org");
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute("href", /\/es\/manifesto$/);

  await page.goto("/es/manifesto");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Manifiesto");
  await expect(page.getByRole("heading", { level: 2, name: /Tus palabras son tuyas/ })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByTestId("manifesto-link")).toHaveText("Manifiesto");
});
