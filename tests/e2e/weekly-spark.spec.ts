import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { becomeAdmin } from "./admin";
import { waitSaved, writeStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

/** This week's Monday (UTC), like the database counts weeks. */
function thisMonday(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day)).toISOString().slice(0, 10);
}

test("admins set the weekly spark; writers answer it and the answers gather on its page", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const textEn = `Write about a door you never opened ${stamp}`;
  const textEs = `Escribe sobre una puerta que nunca abriste ${stamp}`;
  const email = await signInWithMagicLink(page, "en");
  await becomeAdmin(page, email);

  await page.getByTestId("account-menu").click();
  await page.getByTestId("admin-prompts-link").click();
  await expect(page).toHaveURL(/\/en\/admin\/prompts$/);
  const form = page.getByTestId("prompt-form");
  await form.getByLabel("Week starting (a Monday)").fill(thisMonday());
  await form.getByLabel("Prompt in English").fill(textEn);
  await form.getByLabel("Prompt in Spanish").fill(textEs);
  await form.getByRole("button", { name: "Save spark" }).click();
  await expect(page.getByTestId("prompt-list")).toContainText(textEn);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // On the home page, in each language.
  await page.goto("/es");
  await expect(page.getByTestId("weekly-spark")).toContainText(textEs);
  await page.goto("/en");
  const card = page.getByTestId("weekly-spark");
  await expect(card).toContainText(textEn);
  await card.getByTestId("spark-write").click();

  // The draft knows which spark it answers.
  await expect(page).toHaveURL(/\/en\/write\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("spark-banner")).toContainText(textEn);
  const title = `The door ${stamp}`;
  await writeStory(page, title);
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.getByTestId("story-spark").click();
  await expect(page).toHaveURL(new RegExp(`/en/prompts/${thisMonday()}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(textEn);
  await expect(page.getByTestId("prompt-entries")).toContainText(title);
  await page.goto("/en/prompts");
  await expect(page.getByTestId("prompt-archive")).toContainText(textEn);
});
