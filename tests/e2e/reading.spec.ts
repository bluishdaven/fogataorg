import { expect, test } from "@playwright/test";

test("home lists published stories in both languages, never drafts or unlisted", async ({ page }) => {
  await page.goto("/en");
  const list = page.getByTestId("story-list");
  await expect(list.getByRole("link", { name: "The heron knows something I don't" })).toBeVisible();
  await expect(list.getByRole("link", { name: "El mole de mi abuela no tiene receta" })).toBeVisible();
  // Seeded stories plus any published while developing.
  expect(await list.getByRole("article").count()).toBeGreaterThanOrEqual(17);
  await expect(list.getByText("Chiles en nogada para principiantes")).toHaveCount(0);
  await expect(list.getByText("Untitled river piece")).toHaveCount(0);
  await expect(list.getByText("Notas sueltas sobre el temblor")).toHaveCount(0);
});

test("a story card opens the story at its share URL", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "The bug was in the calendar" }).click();
  await expect(page).toHaveURL(/\/@arjun_builds\/the-bug-was-in-the-calendar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The bug was in the calendar");
  await expect(page.getByRole("article")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 2, name: "The fix" })).toBeVisible();
});

test("unlisted stories open by direct link", async ({ page }) => {
  await page.goto("/@mateo_rios/notas-sueltas-sobre-el-temblor");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Notas sueltas sobre el temblor");
});

test("drafts are not readable by the public", async ({ page }) => {
  await page.goto("/@lucia_ortega/chiles-en-nogada-para-principiantes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");
});

test("profiles list the writer's published stories", async ({ page }) => {
  await page.goto("/@marcusbell");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Marcus Bell");
  await expect(page.getByText("3 stories")).toBeVisible();
});

test("unknown pages show the localized not-found page", async ({ page }) => {
  await page.goto("/es/no-existe");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aquí se pierde el rastro");
});

test("the title and writer stay in a slim bar while reading, and leave at the top", async ({ page }) => {
  await page.goto("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta");
  const bar = page.getByTestId("story-title-bar");
  await expect(bar).toHaveAttribute("data-shown", "false");
  await expect(bar).toBeHidden();

  // Past the byline, the bar slides in under the site header with both.
  await page.locator("#story-body").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await expect(bar).toHaveAttribute("data-shown", "true");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("El mole de mi abuela no tiene receta");
  await expect(bar).toContainText("Lucía Ortega");
  // It repeats the page's own header, so assistive tech skips it.
  await expect(bar).toHaveAttribute("aria-hidden", "true");

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toHaveAttribute("data-shown", "false");
});
