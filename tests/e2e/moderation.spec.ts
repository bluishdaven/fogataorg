import { expect, test } from "@playwright/test";
import { becomeAdmin, setAdmin } from "./admin";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

test("admins mark stories NSFW, remove them with a public reason, and lift moderation", async ({ browser }) => {
  test.setTimeout(150_000);
  const writerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const readerContext = await browser.newContext();
  const writer = await writerContext.newPage();
  const admin = await adminContext.newPage();
  const reader = await readerContext.newPage();

  await signInWithMagicLink(writer, "en");
  const title = `Moderated story ${Date.now()}`;
  const storyUrl = await publishStory(writer, title);
  const profileUrl = storyUrl.replace(/\/[^/]+$/, "");

  const adminEmail = await signInWithMagicLink(admin, "en");
  // Not an admin yet: no controls, no admin page.
  await admin.goto(storyUrl);
  await expect(admin.getByTestId("moderation-panel")).toHaveCount(0);
  await admin.goto("/en/admin/moderation");
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");

  try {
    await becomeAdmin(admin, adminEmail);

    // NSFW: a warning with the reason, kept off the home feed, labelled on the profile.
    await admin.goto(storyUrl);
    await admin.getByTestId("moderation-nsfw").click();
    await admin.getByTestId("moderation-apply").click();
    await expect(admin.getByTestId("moderation-panel").getByRole("alert")).toHaveText("Add a reason. Readers will see it.");
    await admin.getByLabel("Reason (shown on the story)").fill("Graphic violence (test)");
    await admin.getByTestId("moderation-apply").click();
    await expect(admin.getByTestId("moderation-current")).toHaveText("Marked NSFW: Graphic violence (test)");

    await reader.goto(storyUrl);
    await expect(reader.getByTestId("nsfw-gate")).toContainText("Marked NSFW for: Graphic violence (test)");
    await expect(reader.getByTestId("nsfw-content")).toBeHidden();
    await reader.getByTestId("nsfw-show").click();
    await expect(reader.locator("#story-body")).toBeVisible();
    await reader.goto("/en");
    await expect(reader.getByRole("main")).not.toContainText(title);
    await reader.goto(profileUrl);
    await expect(reader.getByTestId("story-list").or(reader.getByRole("main")).getByText(title)).toBeVisible();
    await expect(reader.getByRole("main").getByTestId("nsfw-label").first()).toBeVisible();

    // Removed: a notice with the reason, for everyone; the writer sees why in Your stories.
    await admin.goto(storyUrl);
    await admin.getByTestId("moderation-remove").click();
    await admin.getByLabel("Reason (shown on the story)").fill("Spam (test)");
    await admin.getByTestId("moderation-apply").click();
    await expect(admin.getByTestId("removed-notice")).toBeVisible();

    await reader.goto(storyUrl);
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText("This story was moderated");
    await expect(reader.getByTestId("removed-notice")).toContainText("Moderated for: Spam (test)");
    await expect(reader.getByText(title)).toHaveCount(0);
    await reader.goto(profileUrl);
    await expect(reader.getByRole("main")).not.toContainText(title);

    await writer.goto("/en/me/stories");
    await expect(writer.getByTestId("my-story").filter({ hasText: title }).getByTestId("my-story-moderation")).toHaveText(
      "Removed by moderation: Spam (test)",
    );

    // The moderation page lists it; lifting brings the story back.
    await admin.getByTestId("account-menu").click();
    await admin.getByTestId("admin-moderation-link").click();
    const row = admin.getByTestId("moderated-story").filter({ hasText: title });
    await expect(row).toContainText("Removed");
    await row.getByTestId("moderation-lift").click();
    await expect(admin.getByTestId("moderated-story").filter({ hasText: title })).toHaveCount(0);
    await expect(admin.getByTestId("moderation-log")).toContainText(title);

    await reader.goto(storyUrl);
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(reader.getByTestId("nsfw-gate")).toHaveCount(0);
  } finally {
    await setAdmin(adminEmail, false);
    await deleteFromMyStories(writer, title);
    await writerContext.close();
    await adminContext.close();
    await readerContext.close();
  }
});
