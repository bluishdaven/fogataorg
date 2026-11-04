import { expect, test } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

test("the photo search API rejects anonymous requests", async ({ request }) => {
  const response = await request.get("/api/unsplash/search?q=campfire");
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorized" });
});

test("signed-out visitors are asked to sign in before searching", async ({ page }) => {
  await page.goto("/en/design");
  await page.getByTestId("unsplash-trigger").click();
  await expect(page.getByRole("dialog", { name: "Free photos from Unsplash" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search photos" }).fill("campfire");
  await expect(page.getByTestId("unsplash-message")).toHaveText("Sign in to search photos.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("writers get a clear message when Unsplash isn't configured", async ({ page }) => {
  test.skip(Boolean(process.env.UNSPLASH_ACCESS_KEY), "Unsplash is configured in this environment");
  await signInWithMagicLink(page, "es");
  await page.goto("/es/design");
  await page.getByTestId("unsplash-trigger").click();
  await page.getByRole("button", { name: "fogata" }).click();
  await expect(page.getByTestId("unsplash-message")).toHaveText("La búsqueda de fotos aún no está configurada.");
});
