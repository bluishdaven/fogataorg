import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInWithMagicLink } from "./sign-in";

const stamp = Date.now();
const wordpressExport = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/"><channel>
<item><title>Notes from the dock ${stamp}</title><link>https://blog.example/notes-from-the-dock/</link>
<content:encoded><![CDATA[<p>The boats came in late and the gulls were the first to know it. We waited on the dock with our coffee going cold.</p>
<h2>What the water said</h2><p>Nothing, at first. Then <em>everything</em>, all at once.</p>
<figure><img src="http://127.0.0.1:9/picture.jpg" alt="The dock at dawn"><figcaption>Dawn</figcaption></figure>]]></content:encoded>
<excerpt:encoded><![CDATA[A morning by the water]]></excerpt:encoded><wp:post_id>1</wp:post_id><wp:post_date_gmt>2020-06-01 08:00:00</wp:post_date_gmt><wp:status>publish</wp:status><wp:post_type>post</wp:post_type></item>
<item><title>La casa de mi abuela ${stamp}</title><link>https://blog.example/la-casa/</link>
<content:encoded><![CDATA[La casa de mi abuela tenía un patio con limones y una mesa larga donde comíamos los domingos.

Ella decía que el pan se hace despacio, como todo lo que vale la pena.]]></content:encoded>
<excerpt:encoded><![CDATA[]]></excerpt:encoded><wp:post_id>2</wp:post_id><wp:post_date_gmt>2021-02-03 10:00:00</wp:post_date_gmt><wp:status>publish</wp:status><wp:post_type>post</wp:post_type></item>
<item><title>Half-finished</title><content:encoded><![CDATA[<p>Someday.</p>]]></content:encoded><wp:post_id>3</wp:post_id><wp:status>draft</wp:status><wp:post_type>post</wp:post_type></item>
</channel></rss>`;

test("writers import a WordPress export as drafts, in the right languages, with pictures they can't copy left as links", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithMagicLink(page, "en");
  await page.goto("/en/me/stories");
  await page.getByTestId("import-link").click();
  await expect(page).toHaveURL(/\/en\/write\/import$/);
  await expect(async () => {
    await page.getByTestId("import-file").setInputFiles({ name: "blog.WordPress.xml", mimeType: "text/xml", buffer: Buffer.from(wordpressExport) });
    await expect(page.getByRole("heading", { name: "3 posts from WordPress" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const list = page.getByTestId("import-posts");
  const english = list.getByRole("listitem").filter({ hasText: `Notes from the dock ${stamp}` });
  const spanish = list.getByRole("listitem").filter({ hasText: `La casa de mi abuela ${stamp}` });
  const draft = list.getByRole("listitem").filter({ hasText: "Half-finished" });
  await expect(english.getByRole("checkbox")).toBeChecked();
  await expect(draft.getByRole("checkbox")).not.toBeChecked();
  await expect(english.getByRole("combobox")).toHaveValue("en");
  await expect(spanish.getByRole("combobox")).toHaveValue("es");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.getByTestId("import-run").click();
  await expect(page.getByRole("heading", { name: "2 drafts are ready" })).toBeVisible({ timeout: 45_000 });
  const results = page.getByTestId("import-results");
  await expect(results.getByRole("listitem").filter({ hasText: `Notes from the dock ${stamp}` })).toContainText("1 picture couldn't be copied (left as a link)");

  // Drafts, with their text, never published.
  await results.getByRole("link", { name: `Notes from the dock ${stamp}` }).click();
  await expect(page.getByText("The boats came in late and the gulls were the first to know it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "🖼 The dock at dawn" })).toBeVisible();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql<{ title: string; status: string; language: string; canonical_url: string | null; subtitle: string }[]>`
      select title, status, language, canonical_url, subtitle from public.stories where title like ${`%${stamp}`} order by title`;
    expect(rows).toEqual([
      { title: `La casa de mi abuela ${stamp}`, status: "draft", language: "es", canonical_url: "https://blog.example/la-casa/", subtitle: "" },
      { title: `Notes from the dock ${stamp}`, status: "draft", language: "en", canonical_url: "https://blog.example/notes-from-the-dock/", subtitle: "A morning by the water" },
    ]);
  } finally {
    await sql.end();
  }
});

test("an unreadable file explains what to upload", async ({ page }) => {
  await signInWithMagicLink(page, "es");
  await page.goto("/es/write/import");
  // Picking a file before the page has hydrated does nothing, so try again until it answers.
  await expect(async () => {
    await page.getByTestId("import-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("just some words") });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("No pudimos leer ese archivo.", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
});
