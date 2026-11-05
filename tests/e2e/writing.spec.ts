import { expect, test } from "@playwright/test";
import { deleteFromMyStories, startDraft, waitSaved, writeStory } from "./helpers";
import { solidPng } from "./png";
import { signInWithMagicLink } from "./sign-in";

test("write, autosave, add an image, publish, then delete", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `A night by the water ${Date.now()}`;
  await writeStory(page, title);

  // The "/" menu turns the next line into a heading.
  await page.keyboard.press("Enter");
  await page.keyboard.type("/head");
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("After midnight");
  await waitSaved(page);

  // Autosave reached the server: a reload shows the same story.
  await page.reload();
  await expect(page.getByTestId("editor-title")).toHaveValue(title);
  const heading = page.getByTestId("editor-body").getByRole("heading", { level: 2, name: "After midnight" });
  await expect(heading).toBeVisible();

  // Upload an image at the end of the story.
  await heading.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.getByTestId("image-input").setInputFiles({ name: "ember.png", mimeType: "image/png", buffer: solidPng(64, 48, [232, 89, 12]) });
  await expect(page.getByTestId("figure-alt")).toBeVisible({ timeout: 15_000 });
  await waitSaved(page);
  // Fields inside a figure keep their focus outline (only the writing surface relies on the caret).
  await page.getByTestId("figure-alt").focus();
  await expect.poll(() => page.getByTestId("figure-alt").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");

  // Publishing requires alt text on every image.
  await page.getByTestId("open-publish").click();
  await page.getByRole("button", { name: "Nature" }).click();
  await page.getByTestId("publish-submit").click();
  await expect(page.getByTestId("publish-errors")).toContainText("Every image in the story needs alt text.");
  await page.getByRole("button", { name: "Cancel" }).click();
  // Closing the dialog hands focus back to the button that opened it.
  await expect(page.getByTestId("open-publish")).toBeFocused();

  await page.getByTestId("figure-alt").fill("A small orange square");
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();

  await expect(page).toHaveURL(/\/@e2e[a-z0-9_]+\/a-night-by-the-water-\d+$/);
  const storyUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator("article figure img")).toHaveAttribute("alt", "A small orange square");
  await expect(page.getByRole("link", { name: "Nature" })).toBeVisible();

  // The home list shows the story with a thumbnail of its first picture.
  await page.goto("/en");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: title }).getByTestId("story-thumbnail")).toBeVisible();

  await deleteFromMyStories(page, title);
  await page.goto(storyUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");
});

test("explains what's missing before a story can be published", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  await page.getByTestId("editor-body").click();
  await page.keyboard.type("Too short.");
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  const errors = page.getByTestId("publish-errors");
  await expect(errors).toContainText("Add a title.");
  await expect(errors).toContainText("Write at least a few sentences");
});

test("scheduled stories wait in Your stories and stay off the site", async ({ page }) => {
  test.setTimeout(60_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `Scheduled ember ${Date.now()}`;
  await writeStory(page, title);
  await waitSaved(page);

  await page.getByTestId("open-publish").click();
  await page.getByLabel("Schedule for later").check();
  await expect(page.getByLabel("Date and time (your time zone)")).not.toHaveValue("");
  await page.getByTestId("publish-submit").click();

  await expect(page).toHaveURL(/\/en\/me\/stories/);
  await expect(page.getByRole("region", { name: /^Scheduled/ })).toContainText(title);
  await page.goto("/en");
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);

  await deleteFromMyStories(page, title);
});

test("edits to a live story stay private until published", async ({ page }) => {
  test.setTimeout(60_000);
  await signInWithMagicLink(page, "en");
  await startDraft(page);
  const title = `Live edit ${Date.now()}`;
  await writeStory(page, title);
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const storyUrl = page.url();

  await page.goto("/en/me/stories");
  await page.getByTestId("my-story").filter({ hasText: title }).getByRole("link", { name: "Edit" }).click();
  await expect(page.getByText("You're editing a published story.")).toBeVisible();
  await page.getByTestId("editor-title").fill(`${title} (revised)`);
  await waitSaved(page);

  await page.goto(storyUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.goBack();
  await page.getByTestId("open-publish").click();
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page).toHaveURL(storyUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} (revised)`);

  await deleteFromMyStories(page, `${title} (revised)`);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("photos have their own button, and formatting waits for a selection", async ({ page }) => {
    test.setTimeout(90_000);
    await signInWithMagicLink(page, "en");
    await startDraft(page);
    const addPhoto = page.getByTestId("add-photo");
    await expect(addPhoto).toBeEnabled();
    // A new draft starts with nothing selected by the writer: no formatting bar over it.
    await expect(page.getByTestId("selection-toolbar")).toBeHidden();

    const upload = async (name: string, color: [number, number, number]) => {
      await addPhoto.click();
      const chooser = page.waitForEvent("filechooser");
      await page.getByTestId("add-photo-upload").click();
      await (await chooser).setFiles({ name, mimeType: "image/png", buffer: solidPng(64, 48, color) });
      // Let the menu finish closing (no person taps again within its 100 ms fade).
      await expect(page.getByRole("menu")).toHaveCount(0);
    };
    const figures = page.getByTestId("editor-body").locator("figure");

    // Before the writer taps the story, a photo fills the blank draft.
    await upload("first.png", [232, 89, 12]);
    await expect(figures).toHaveCount(1, { timeout: 15_000 });

    // With a photo selected, the next one goes after it instead of replacing it.
    await figures.first().locator("img").click();
    await upload("second.png", [40, 90, 160]);
    await expect(figures).toHaveCount(2, { timeout: 15_000 });

    // Unsplash is one tap away too.
    await addPhoto.click();
    await page.getByTestId("add-photo-unsplash").click();
    await expect(page.getByRole("dialog", { name: "Free photos from Unsplash" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Selecting words brings the formatting bar.
    await page.getByTestId("editor-body").locator("p").last().click();
    await page.keyboard.type("Embers in the dark");
    await page.keyboard.press("Shift+Home");
    await expect(page.getByTestId("selection-toolbar")).toBeVisible();
  });
});
