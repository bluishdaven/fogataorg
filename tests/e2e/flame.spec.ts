import { expect, test } from "@playwright/test";

const outerShape = (page: import("@playwright/test").Page) =>
  page.locator("header .flame-live .flame-outer").evaluate((path) => getComputedStyle(path).getPropertyValue("d"));

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
  const flame = page.locator("header .flame-live");
  await expect(flame).toBeVisible();
  expect(await flame.evaluate((svg) => svg.getAnimations({ subtree: true }).length)).toBe(0);
  // Sparks never show.
  expect(await flame.locator(".flame-spark").first().evaluate((spark) => getComputedStyle(spark).opacity)).toBe("0");
});

test("the flame settles after its opening dance, leaving only the cheap sway", async ({ page }) => {
  // The outline, the heart and the sparks repaint every frame: they must stop (2026-11-18 phone slowness).
  await page.goto("/en");
  const running = () =>
    page.locator("header .flame-live").evaluate((flame) =>
      flame.getAnimations({ subtree: true }).filter((a) => a.playState === "running").map((a) => (a as CSSAnimation).animationName),
    );
  await expect.poll(running, { timeout: 12_000, intervals: [1_000] }).toEqual(["flame-breathe"]);
  // Pointing at it brings the dance back.
  await page.locator("header a").first().hover();
  await expect.poll(running).toContain("flame-dance");
});
