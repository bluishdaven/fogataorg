import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { closePublishedMoment, startDraft, waitSaved, writeStory } from "./helpers";
import { solidPng } from "./png";
import { signInWithMagicLink } from "./sign-in";

async function countRows(email: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<{ users: number; files: number }[]>`
      select
        (select count(*)::int from auth.users where email = ${email}) as users,
        (select count(*)::int from storage.objects o
          where split_part(o.name, '/', 1) in (select id::text from auth.users where email = ${email})) as files`;
    return row!;
  } finally {
    await sql.end();
  }
}

test("people can download their data and delete their account, photos included", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const email = await signInWithMagicLink(page, "en");
  const title = `Leaving soon ${Date.now()}`;
  await startDraft(page);
  await writeStory(page, title);
  await page.keyboard.press("Enter");
  await page.getByTestId("image-input").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: solidPng(64, 48, [10, 120, 90]) });
  await expect(page.getByTestId("figure-alt")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("figure-alt").fill("A green square");
  await waitSaved(page);
  await page.getByTestId("open-publish").click();
  await page.getByTestId("publish-submit").click();
  await closePublishedMoment(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const storyUrl = page.url();
  expect((await countRows(email)).files).toBeGreaterThan(0);

  await page.goto("/en/settings/account");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  const downloading = page.waitForEvent("download");
  await page.getByTestId("export-data").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^fogata-e2e[a-z0-9_]+-data\.json$/);
  const file = testInfo.outputPath("data.json");
  await download.saveAs(file);
  const data = JSON.parse(await readFile(file, "utf8"));
  expect(data.account.email).toBe(email);
  expect(data.stories[0]).toMatchObject({ title, status: "published" });
  expect(data.stories[0].text).toContain("We built the fire");

  // The button stays off until the username is typed back.
  const username = data.profile.username as string;
  const remove = page.getByTestId("delete-account");
  await expect(remove).toBeDisabled();
  await page.getByLabel(/To confirm, type your username/).fill("someone-else");
  await expect(remove).toBeDisabled();
  await page.getByLabel(/To confirm, type your username/).fill(username);
  await remove.click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByTestId("sign-in-link")).toBeVisible();
  expect(await countRows(email)).toEqual({ users: 0, files: 0 });
  await page.goto(storyUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");
});
