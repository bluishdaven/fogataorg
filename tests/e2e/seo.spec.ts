import { expect, test, type Page } from "@playwright/test";
import { signInWithMagicLink } from "./sign-in";

async function structuredData(page: Page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => JSON.parse(text) as Record<string, unknown>);
}

test("robots.txt keeps crawlers out of non-public builds, and the sitemap lists public pages", async ({ request }) => {
  // Local, CI and preview builds aren't the public site.
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta</loc>");
  expect(xml).toContain("/@lucia_ortega</loc>");
  expect(xml).toMatch(/<loc>[^<]*\/es\/topics<\/loc>/);
  expect(xml).toContain('hreflang="es"');
  expect(xml).not.toContain("draft-");
});

test("localized pages name their language versions; stories, profiles and the home page carry structured data", async ({ page }) => {
  await page.goto("/es/topics");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/es\/topics$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/topics$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/en\/topics$/);

  await page.goto("/en");
  expect((await structuredData(page))[0]?.["@graph"]).toEqual(
    expect.arrayContaining([expect.objectContaining({ "@type": "WebSite", name: "Fogata" })]),
  );

  await page.goto("/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta");
  const [article] = await structuredData(page);
  expect(article).toMatchObject({
    "@type": "Article",
    headline: "El mole de mi abuela no tiene receta",
    inLanguage: "es",
    author: { "@type": "Person", name: "Lucía Ortega" },
  });
  expect(article?.wordCount).toBeGreaterThan(100);

  await page.goto("/@lucia_ortega");
  const [profile] = await structuredData(page);
  expect(profile).toMatchObject({ "@type": "ProfilePage", mainEntity: { "@type": "Person", alternateName: "@lucia_ortega" } });
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("a profile without stories stays out of search results until the first one", async ({ page }) => {
  await signInWithMagicLink(page, "en");
  await page.goto("/en/settings/profile");
  const username = await page.getByLabel("Username").inputValue();
  await page.goto(`/@${username}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
