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
