import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { startDraft } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

test("the theme choice applies and survives a reload", async ({ page }) => {
  await page.goto("/en");
  await page.getByTestId("theme-switcher").click();
  await page.getByRole("menuitemradio", { name: "Sepia" }).click();
  await expect(page.locator("html")).toHaveClass(/sepia/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/sepia/);
  // The theme's colors only: Tailwind's `sepia` filter utility must never apply to the page.
  await expect(page.locator("html")).toHaveCSS("filter", "none");
});

const pages = [
  ["home (en)", "/en"],
  ["home (es)", "/es"],
  ["login", "/es/login"],
  ["style guide", "/en/design"],
  ["story", "/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta"],
  ["profile", "/@danawrites"],
  ["manifesto", "/es/manifesto"],
  ["privacy", "/en/privacy"],
] as const;

for (const theme of ["light", "dark", "sepia"] as const) {
  for (const [name, path] of pages) {
    test(`${name} has no WCAG A/AA violations in ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      // Let streamed sections replace their skeletons before scanning.
      await expect(page.locator("main .animate-pulse")).toHaveCount(0);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const theme of ["light", "dark", "sepia"] as const) {
  // Phone width: that's where controls collapse to icons and can lose their names.
  test(`the editor and account pages have no WCAG A/AA violations in ${theme}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    await signInWithMagicLink(page, "en");
    await startDraft(page);
    await expect(page.getByRole("heading", { level: 1, name: "Write" })).toBeAttached();
    await expect(page.getByRole("link", { name: "Your stories" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    for (const path of ["/en/settings/profile", "/en/settings/notifications", "/en/me/notifications", "/en/me/stories"]) {
      await page.goto(path);
      await expect(page.locator("main .animate-pulse")).toHaveCount(0);
      expect(await seriousViolations(page), path).toEqual([]);
    }
  });
}

for (const theme of ["light", "dark", "sepia"] as const) {
  test(`the badge guide has no WCAG A/AA violations in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    await page.goto("/@danawrites");
    await page.getByTestId("badge-chip").first().click();
    const guide = page.getByTestId("badge-guide");
    await expect(guide).toBeVisible();
    await expect(guide.getByTestId("badge-ladder").getByRole("listitem")).toHaveCount(10);
    const results = await new AxeBuilder({ page })
      .include('[data-testid="badge-guide"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

/** WCAG contrast of an element's text against its background, read through a canvas so any CSS color works. */
const ownContrast = (el: Element) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // Paints the layers bottom-up, so translucent colors are judged as they appear on the page.
  const rgb = (...layers: string[]) => {
    ctx.clearRect(0, 0, 1, 1);
    for (const color of layers) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminance = (c: number[]) =>
    c
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
  const style = getComputedStyle(el);
  const page = getComputedStyle(document.body).backgroundColor;
  const [a, b] = [luminance(rgb(page, style.backgroundColor, style.color)), luminance(rgb(page, style.backgroundColor))].sort(
    (x, y) => y - x,
  );
  return (a! + 0.05) / (b! + 0.05);
};

for (const theme of ["light", "dark", "sepia"] as const) {
  // axe only sees resting states; a hover that lightens the button can drop its label below AA.
  test(`a hovered primary button keeps AA text contrast in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    await page.goto("/en");
    const signIn = page.getByTestId("sign-in-link");
    const resting = await signIn.evaluate(ownContrast);
    await signIn.hover();
    await expect.poll(() => signIn.evaluate(ownContrast)).toBeGreaterThan(resting);
    expect(await signIn.evaluate(ownContrast)).toBeGreaterThanOrEqual(4.5);
  });
}
