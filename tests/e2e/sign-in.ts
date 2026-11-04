import { expect, type Page } from "@playwright/test";
import { waitForMagicLink } from "./mailpit";

/** Signs in a brand-new reader through the real magic-link flow. Returns their email. */
export async function signInWithMagicLink(page: Page, locale: "en" | "es" = "en"): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@fogata.test`;
  await page.goto(`/${locale}/login`);
  await page.getByLabel(locale === "es" ? "Correo electrónico" : "Email").fill(email);
  await page.getByRole("button", { name: locale === "es" ? "Envíame un enlace para entrar" : "Email me a sign-in link" }).click();
  await expect(page.getByTestId("magic-link-sent")).toContainText(email);
  await page.goto(await waitForMagicLink(email));
  await expect(page.getByTestId("account-menu")).toBeVisible();
  return email;
}
