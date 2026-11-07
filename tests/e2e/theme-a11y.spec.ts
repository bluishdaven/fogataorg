import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the theme choice applies and survives a reload", async ({ page }) => {
  await page.goto("/en");
  await page.getByTestId("theme-switcher").click();
  await page.getByRole("menuitemradio", { name: "Sepia" }).click();
  await expect(page.locator("html")).toHaveClass(/sepia/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/sepia/);
});

const pages = [
  ["home (en)", "/en"],
  ["home (es)", "/es"],
  ["login", "/es/login"],
  ["style guide", "/en/design"],
  ["story", "/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta"],
  ["profile", "/@danawrites"],
  ["manifesto", "/es/manifesto"],
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
