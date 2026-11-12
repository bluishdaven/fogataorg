import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { becomeAdmin, clearFeatures } from "./admin";
import { closePublishedMoment, deleteFromMyStories, waitSaved, writeStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function noSeriousViolations(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
}

// Both tests rewrite this week's spark, so they take turns.
test.describe.configure({ mode: "serial" });

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
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.getByTestId("story-spark").click();
  await expect(page).toHaveURL(new RegExp(`/en/prompts/${thisMonday()}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(textEn);
  await expect(page.getByTestId("prompt-entries")).toContainText(title);
  await page.goto("/en/prompts");
  await expect(page.getByTestId("prompt-archive")).toContainText(textEn);
});

test("admins feature a weekly spark entry; the writer hears about it", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const monday = thisMonday();
  await clearFeatures(monday);
  const adminEmail = await signInWithMagicLink(page, "en");
  await becomeAdmin(page, adminEmail);
  await page.goto("/en/admin/prompts");
  const form = page.getByTestId("prompt-form");
  await form.getByLabel("Week starting (a Monday)").fill(monday);
  await form.getByLabel("Prompt in English").fill(`Write about smoke ${stamp}`);
  await form.getByLabel("Prompt in Spanish").fill(`Escribe sobre el humo ${stamp}`);
  await form.getByRole("button", { name: "Save spark" }).click();
  await expect(page.getByTestId("prompt-list")).toContainText(`Write about smoke ${stamp}`);

  // A writer answers it.
  const writerContext = await browser.newContext();
  const writer = await writerContext.newPage();
  await signInWithMagicLink(writer, "en");
  await writer.goto("/en");
  await writer.getByTestId("weekly-spark").getByTestId("spark-write").click();
  await expect(writer).toHaveURL(/\/en\/write\/[0-9a-f-]{36}$/);
  const title = `Smoke ${stamp}`;
  await writeStory(writer, title);
  await waitSaved(writer);
  await writer.getByTestId("open-publish").click();
  await writer.getByTestId("publish-submit").click();
  await closePublishedMoment(writer);
  await expect(writer.getByRole("heading", { level: 1 })).toHaveText(title);
  const storyUrl = writer.url();

  // The admin features it from the spark's page.
  await page.goto(`/en/prompts/${monday}`);
  await page.getByTestId("prompt-entries").locator("> div").filter({ hasText: title }).getByTestId("feature-toggle").click();
  const featured = page.getByTestId("prompt-featured");
  await expect(featured).toContainText(title);
  await expect(featured.getByTestId("feature-toggle")).toHaveAttribute("aria-pressed", "true");
  await noSeriousViolations(page);

  // The writer gets a notification, and the story says so.
  await writer.goto("/en/me/notifications");
  await expect(writer.getByTestId("notifications-list")).toContainText(`Your story “${title}” was featured in the weekly spark`);
  await writer.goto(storyUrl);
  await expect(writer.getByTestId("story-spark")).toContainText("Featured in the weekly spark");

  // Taking it back.
  await featured.getByTestId("feature-toggle").click();
  await expect(page.getByTestId("prompt-featured")).toHaveCount(0);
  await expect(page.getByTestId("prompt-entries")).toContainText(title);
  await deleteFromMyStories(writer, title);
  await writerContext.close();
});
