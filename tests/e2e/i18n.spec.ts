import { expect, test } from "@playwright/test";

test.describe("Spanish browser", () => {
  test.use({ locale: "es-MX" });

  test("lands on the Spanish home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acércate. Alguien está contando una historia.");
  });
});

test("English browsers land on the English home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pull up a seat. Someone is telling a story.");
});

test("the language menu swaps the UI prefix and keeps the page", async ({ page }) => {
  await page.goto("/en/design");
  await page.getByTestId("language-switcher").click();
  await page.getByRole("menuitemradio", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/es\/design$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guía de estilo");
});

test("share URLs keep their address and follow the saved language", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL! }]);
  await page.goto("/@danawrites");
  await expect(page).toHaveURL(/\/@danawrites$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByText(/En Fogata desde/)).toBeVisible();

  await page.getByTestId("language-switcher").click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.getByText(/On Fogata since/)).toBeVisible();
  await expect(page).toHaveURL(/\/@danawrites$/);
});

test("internal story paths redirect to the share URL", async ({ page }) => {
  await page.goto("/en/u/danawrites");
  await expect(page).toHaveURL(/\/@danawrites$/);
});
