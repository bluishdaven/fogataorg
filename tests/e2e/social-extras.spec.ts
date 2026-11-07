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

test("readers can edit their responses, which then show as edited", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  const text = `First thought ${Date.now()}`;
  await page.getByLabel("Your response").fill(text);
  await page.getByRole("button", { name: "Respond", exact: true }).click();
  const response = page.getByTestId("response").filter({ hasText: text });
  await expect(response).toBeVisible();
  await expect(response.getByTestId("response-edited")).toBeHidden();

  await response.getByRole("button", { name: "Edit" }).click();
  const field = response.getByLabel("Edit your response");
  await expect(field).toBeFocused();
  await field.fill(`${text}, on second thought`);
  await response.getByRole("button", { name: "Save" }).click();
  await expect(response).toContainText("on second thought");
  await expect(response.getByTestId("response-edited")).toHaveText("edited");
  await expect(response.getByRole("button", { name: "Edit" })).toBeFocused();

  await page.reload();
  const reloaded = page.getByTestId("response").filter({ hasText: `${text}, on second thought` });
  await expect(reloaded.getByTestId("response-edited")).toBeVisible();

  // Clean up.
  page.once("dialog", (dialog) => void dialog.accept());
  await reloaded.getByRole("button", { name: "Delete" }).click();
  await expect(reloaded).toBeHidden();
});
