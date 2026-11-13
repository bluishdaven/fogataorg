import { expect, test } from "@playwright/test";

const outerShape = (page: import("@playwright/test").Page) =>
  page.locator("header svg.flame-live .flame-outer").evaluate((path) => getComputedStyle(path).getPropertyValue("d"));

test("the header flame is alive: its outline moves", async ({ page }) => {
  await page.goto("/en");
  const first = await outerShape(page);
  await expect.poll(() => outerShape(page), { timeout: 5_000 }).not.toBe(first);
  // Still logos (footer) never animate.
  expect(await page.locator("footer svg").first().evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBe(0);
});

test("the flame holds still for people who ask for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const flame = page.locator("header svg.flame-live");
  await expect(flame).toBeVisible();
  expect(await flame.evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBe(0);
  // Sparks never show.
  expect(await flame.locator(".flame-spark").first().evaluate((spark) => getComputedStyle(spark).opacity)).toBe("0");
});
