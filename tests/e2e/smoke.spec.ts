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
