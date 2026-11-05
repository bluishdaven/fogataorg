import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { solidPng } from "./png";
import { signInWithMagicLink } from "./sign-in";

const AVATAR_URL = /\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;

async function upload(page: Page, rgb: [number, number, number]) {
  await waitForHydration(page);
  await page.getByTestId("avatar-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: solidPng(300, 200, rgb) });
  await expect(page.getByTestId("avatar-status")).toHaveText("Photo saved.", { timeout: 15_000 });
}

/** React attaches its props to an element when it hydrates it; until then a file pick is lost. */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const input = document.querySelector("[data-testid=avatar-input]");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactProps"));
  });
}

const headerPhoto = (page: Page) => page.getByTestId("account-menu").locator("img");

test("people can upload, replace and remove a profile photo", async ({ page, request }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await page.goto("/en/settings/profile");
  await expect(page.getByRole("heading", { name: "Profile photo" })).toBeVisible();
  await expect(headerPhoto(page)).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // A landscape photo is cropped to a square WebP in our bucket and shows in the header.
  await upload(page, [232, 89, 12]);
  await expect(headerPhoto(page)).toHaveAttribute("src", AVATAR_URL);
  const first = (await headerPhoto(page).getAttribute("src"))!;
  const size = await headerPhoto(page).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(size).toEqual([200, 200]);

  // It appears on the public profile too.
  const username = await page.getByLabel("Username").inputValue();
  await page.goto(`/@${username}`);
  await expect(page.getByRole("main").getByTestId("avatar").locator("img")).toHaveAttribute("src", first);

  // Replacing it removes the old file.
  await page.goto("/en/settings/profile");
  await upload(page, [29, 78, 216]);
  await expect(headerPhoto(page)).not.toHaveAttribute("src", first);
  await expect.poll(async () => (await request.get(first)).status(), { timeout: 10_000 }).not.toBe(200);

  // Removing it brings the initials back.
  await page.getByTestId("avatar-remove").click();
  await expect(page.getByTestId("avatar-status")).toHaveText("Photo removed.");
  await expect(headerPhoto(page)).toHaveCount(0);
});

test("files that aren't photos are refused with a clear message", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto("/en/settings/profile");
  await waitForHydration(page);
  await page.getByTestId("avatar-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That file isn't a photo we can use. Try a JPG, PNG or WebP.");
});
