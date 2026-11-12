import { expect, type Page } from "@playwright/test";

export const BODY =
  "We built the fire on the shore just after sunset, when the wind finally dropped and the water turned the color of old silver. Someone had brought tamales.";

export async function startDraft(page: Page) {
  await page.getByTestId("write-button").click();
  await expect(page).toHaveURL(/\/(en|es)\/write\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("editor-body")).toBeVisible();
}

export async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 15_000 });
}

export async function writeStory(page: Page, title: string) {
  await page.getByTestId("editor-title").fill(title);
  await page.getByTestId("editor-subtitle").fill("Testing the editor end to end.");
  await page.getByTestId("editor-body").click();
  await page.keyboard.type(BODY);
}

/** A first publish opens the story with its "it's live" dialog (PublishedMoment); close it to carry on. */
export async function closePublishedMoment(page: Page) {
  const moment = page.getByTestId("published-moment");
  await expect(moment).toBeVisible();
  await moment.getByRole("button", { name: /^(Close|Cerrar)$/ }).click();
  await expect(moment).toBeHidden();
}

/** Writes and publishes a short story; returns its URL. */
export async function publishStory(page: Page, title: string): Promise<string> {
  await startDraft(page);
  await writeStory(page, title);
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  return page.url();
}

export async function deleteFromMyStories(page: Page, title: string) {
  await page.goto("/en/me/stories");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("my-story").filter({ hasText: title }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("my-story").filter({ hasText: title })).toHaveCount(0);
}
