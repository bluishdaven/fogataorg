import { expect, test, type Locator, type Page } from "@playwright/test";

/** Presses Tab until `target` has focus (or gives up), the way a keyboard user gets there. */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("never reached the element with Tab");
}

const outline = (locator: Locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor };
  });

for (const theme of ["light", "dark", "sepia"] as const) {
  test(`keyboard focus is a solid 2px outline on buttons, inputs and story cards in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    await page.goto("/en");
    const ring = await page.evaluate(() => {
      // Resolve the --ring token to the same rgb() form computed styles use.
      const probe = document.createElement("span");
      probe.style.color = "var(--ring)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });

    const themeButton = page.getByTestId("theme-switcher");
    await tabTo(page, themeButton);
    // Buttons transition their outline in, so poll for the settled style.
    await expect.poll(() => outline(themeButton)).toEqual({ style: "solid", width: 2, color: ring });

    // The title link covers the whole card and hides its own outline, so the card draws it.
    const firstStory = page.getByRole("main").getByRole("article").first();
    await tabTo(page, firstStory.getByRole("link").first());
    await expect.poll(() => outline(firstStory)).toEqual({ style: "solid", width: 2, color: ring });

    await page.goto("/en/login");
    const email = page.getByLabel("Email");
    await tabTo(page, email);
    await expect.poll(() => outline(email)).toEqual({ style: "solid", width: 2, color: ring });
  });
}

test("focused elements never hide under the sticky header when tabbing backwards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/en");
  await page.getByRole("contentinfo").getByRole("link").last().focus();
  const headerBottom = await page.locator("body > header").evaluate((el) => el.getBoundingClientRect().bottom);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    const top = await page.evaluate(() => {
      const el = document.activeElement;
      return el && !el.closest("header") ? el.getBoundingClientRect().top : null;
    });
    if (top !== null) expect(top).toBeGreaterThanOrEqual(headerBottom);
  }
});

test("closing the badge guide puts focus back on the badge that opened it", async ({ page }) => {
  await page.goto("/@danawrites");
  const chip = page.getByTestId("badge-chip").first();
  await tabTo(page, chip);
  await page.keyboard.press("Enter");
  const guide = page.getByTestId("badge-guide");
  await expect(guide).toBeVisible();
  // Focus is trapped in the dialog.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await guide.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await expect(chip).toBeFocused();
});

test("the share menu returns focus to its button", async ({ page }) => {
  await page.goto("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta");
  const share = page.getByTestId("share-button");
  await tabTo(page, share, 80);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("share-copy")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(share).toBeFocused();
});
