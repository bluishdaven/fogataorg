import { expect, test } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

const STORY = "/@danawrites/the-heron-knows-something-i-dont";

test("readers can take their sparks back", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  const total = page.getByTestId("spark-total");
  await expect(total).toBeVisible();
  // Start from no sparks, whatever an earlier run left.
  if (await page.getByTestId("spark-undo").isVisible()) {
    await page.getByTestId("spark-undo").click();
    await expect(page.getByTestId("spark-undo")).toBeHidden();
  }
  const before = Number((await total.locator(".sr-only").textContent())!.match(/\d+/)?.[0] ?? 0);

  await page.getByTestId("spark-button").click();
  await page.getByTestId("spark-button").click();
  await expect(total).toContainText(`${before + 2} sparks`);
  await page.getByTestId("spark-undo").click();
  await expect(page.getByTestId("spark-undo")).toBeHidden();
  await expect(page.getByTestId("spark-button")).toBeFocused();

  await page.reload();
  await expect(total.locator(".sr-only")).toHaveText(before === 0 ? "No sparks yet" : new RegExp(`^${before} sparks?$`));
  await expect(page.getByTestId("spark-undo")).toBeHidden();
});
