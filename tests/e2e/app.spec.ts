import { expect, test } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

const STORY = "/@danawrites/the-heron-knows-something-i-dont";

test("Fogata is installable: manifest, icons and the app page", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body).toMatchObject({ name: "Fogata", start_url: "/", display: "standalone" });
  for (const icon of body.icons as { src: string }[]) {
    const file = await request.get(icon.src);
    expect(file.headers()["content-type"]).toBe("image/png");
  }
  const worker = await request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-cache");

  await page.goto("/en");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await page.getByTestId("app-link").click();
  await expect(page).toHaveURL(/\/en\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fogata on your phone");
  // Desktop Chrome in tests: either its own install offer or the menu instructions.
  await expect(page.getByTestId("app-install").or(page.getByTestId("app-manual"))).toBeVisible();
});

test("saved stories can be read offline, and signing out removes them", async ({ page, context }) => {
  // Dev servers only register the worker when asked.
  await page.addInitScript(() => window.localStorage.setItem("fogata:sw-dev", "on"));
  await signInWithMagicLink(page, "en");
  await page.goto(STORY);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });
  const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("save-button")).toHaveAttribute("data-saved", "true");
  await page.keyboard.press("Escape");
  const offlineList = () => page.evaluate(() => JSON.parse(window.localStorage.getItem("fogata:offline") ?? "[]") as { url: string; title: string }[]);
  await expect.poll(async () => (await offlineList()).map((item) => item.url), { timeout: 30_000 }).toContain(STORY);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("fogata:offline-pages:2")), { timeout: 30_000 }).not.toBeNull();

  await context.setOffline(true);
  try {
    await page.goto(STORY);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

    // Anything else shows what this device has.
    await page.goto("/en/topics");
    await expect(page.getByTestId("offline-page")).toBeVisible();
    // The list is drawn in the browser. `next dev`'s hot-reload client can't start offline, so pages
    // don't come alive there; production builds (CI) check the list too.
    const devServer = await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("hmr-client")));
    if (!devServer) {
      await expect(page.getByTestId("offline-banner")).toBeVisible();
      await expect(page.getByTestId("offline-stories").getByRole("link", { name: new RegExp(title) })).toBeVisible();
    }
  } finally {
    await context.setOffline(false);
  }

  // The Saved page offers to download every saved story.
  await page.goto("/en/me/saved");
  await page.getByTestId("offline-sync-button").click();
  await expect(page.getByTestId("offline-sync-status")).toHaveText("1 story ready to read offline.", { timeout: 30_000 });

  await page.getByTestId("account-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("account-menu")).toBeHidden();
  expect(await offlineList()).toEqual([]);
  expect(await page.evaluate(() => caches.has("fogata-offline-v1"))).toBe(false);
});

test("notification settings offer push on this device", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("fogata:sw-dev", "on"));
  await signInWithMagicLink(page, "en");
  await page.goto("/en/settings/notifications");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Notifications");
  await expect(page.getByRole("heading", { name: "On this device" })).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Notifications on this device" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible();
});
