import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

test("writers can edit their profile and see it on their page", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto("/en/settings/profile");
  await page.getByLabel("Name", { exact: true }).fill("Ember Tester");
  await page.getByLabel("Short bio").fill("Writes about fires that go out slowly.");
  await page.getByRole("button", { name: "Add a link" }).click();
  await page.getByLabel("Link label").fill("Website");
  await page.getByLabel("Link URL").fill("ember.example");
  await page.getByTestId("profile-save").click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();

  await page.getByRole("link", { name: "View your profile" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ember Tester");
  await expect(page.getByRole("paragraph").filter({ hasText: "Writes about fires that go out slowly." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://ember.example/");
});

test("reserved usernames are refused with a clear message", async ({ page }) => {
  await signInWithMagicLink(page, "es");
  await page.goto("/es/settings/profile");
  await page.getByLabel("Nombre de usuario").fill("fogata");
  await page.getByTestId("profile-save").click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Ese nombre de usuario está reservado.");
  // The message is tied to the field, so screen readers read it on the field itself.
  const username = page.getByLabel("Nombre de usuario");
  await expect(username).toHaveAttribute("aria-invalid", "true");
  await expect(username).toHaveAccessibleDescription(/Ese nombre de usuario está reservado\./);
});

test("topic pages list stories in the reader's language", async ({ page }) => {
  await page.goto("/es/topics");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Temas");
  await page.getByRole("link", { name: /Naturaleza/ }).click();
  await expect(page).toHaveURL(/\/es\/topics\/nature$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Naturaleza");
  await expect(page.getByRole("link", { name: "The heron knows something I don't" })).toBeVisible();
});

test("story topic chips link to topic pages", async ({ page }) => {
  await page.goto("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta");
  await page.getByRole("link", { name: "Food" }).click();
  await expect(page).toHaveURL(/\/en\/topics\/food$/);
});

test("reader settings apply before paint and survive reloads", async ({ page }) => {
  await page.goto("/@danawrites/the-heron-knows-something-i-dont");
  await page.getByTestId("reader-controls").click();
  await page.getByRole("menuitemradio", { name: "Large", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reader-size", "l");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByTestId("reader-controls").click();
  await page.getByRole("menuitemradio", { name: "Sans serif" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reader-size", "l");
  await expect(page.locator("html")).toHaveAttribute("data-reader-font", "sans");
  await expect(page.locator(".prose-fogata")).toHaveCSS("font-size", "23px");
});

test("signed-in pages have no WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(60_000);
  await signInWithMagicLink(page, "en");
  await page.getByTestId("write-button").click();
  await expect(page).toHaveURL(/\/en\/write\//);
  const editorUrl = page.url();
  for (const theme of ["light", "dark", "sepia"]) {
    await page.evaluate((value) => window.localStorage.setItem("theme", value), theme);
    for (const path of [editorUrl, "/en/settings/profile", "/en/me/stories", "/en/topics"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("main .animate-pulse")).toHaveCount(0);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${theme} ${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
  }
});
