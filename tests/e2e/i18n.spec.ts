import { expect, test } from "@playwright/test";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

test.describe("Spanish browser", () => {
  test.use({ locale: "es-MX" });

  test("lands on the Spanish home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect(es.Home.headlines).toContain(await page.getByRole("heading", { level: 1 }).innerText());
  });

  test("toasts are announced from a region named in Spanish", async ({ page }) => {
    await page.goto("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta");
    await expect(page.getByRole("region", { name: /^Avisos\b/ })).toHaveAttribute("aria-live", "polite");
    await expect(page.getByRole("region", { name: /^Notifications\b/ })).toHaveCount(0);
  });
});

test("English browsers land on the English home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  expect(en.Home.headlines).toContain(await page.getByRole("heading", { level: 1 }).innerText());
});

test("the home headline changes on every visit", async ({ page }) => {
  const heading = page.getByTestId("home-headline");
  const seen: string[] = [];
  for (let visit = 0; visit < 4; visit += 1) {
    await page.goto("/en");
    const text = await heading.innerText();
    expect(en.Home.headlines).toContain(text);
    // Only the shown headline is announced.
    await expect(heading).toHaveAccessibleName(text);
    if (visit > 0) expect(text).not.toBe(seen.at(-1));
    seen.push(text);
  }
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
