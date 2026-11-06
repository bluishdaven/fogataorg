import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/**
 * Makes this reader due in today's run: the job leaves notifications younger than 10 minutes for
 * later and only emails readers whose summary weekday is today.
 */
async function makeDueToday(email: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      update public.notifications set updated_at = updated_at - interval '15 minutes'
      where user_id = (select id from auth.users where email = ${email})`;
    await sql`
      update public.profiles set email_weekday = ${new Date().getUTCDay()}
      where id = (select id from auth.users where email = ${email})`;
  } finally {
    await sql.end();
  }
}

type MailpitMessage = { ID: string; Subject: string; HTML: string; Text: string };

async function waitForSummary(email: string, timeoutMs = 15_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const query = encodeURIComponent(`to:"${email}" subject:"on Fogata"`);
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${query}`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: { ID: string }[] };
      if (messages[0]) return (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as MailpitMessage;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No summary email for ${email}`);
}

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** Links in the email use NEXT_PUBLIC_SITE_URL; keep the path and query so the test hits this server. */
const localPath = (href: string) => {
  const url = new URL(href.replaceAll("&amp;", "&"));
  return url.pathname + url.search;
};

test("the cron route needs its secret", async ({ request }) => {
  expect((await request.get("/api/cron/notification-emails")).status()).toBe(401);
  const wrong = await request.get("/api/cron/notification-emails", { headers: { Authorization: "Bearer nope" } });
  expect(wrong.status()).toBe(401);
});

test("writers get a summary email and can unsubscribe from it", async ({ browser, request }) => {
  test.setTimeout(150_000);
  test.skip(!process.env.CRON_SECRET, "CRON_SECRET not set (run npm run setup:env)");
  const writerContext = await browser.newContext();
  const readerContext = await browser.newContext();
  const writer = await writerContext.newPage();
  const reader = await readerContext.newPage();

  const writerEmail = await signInWithMagicLink(writer, "en");
  const title = `Summary story ${Date.now()}`;
  const storyUrl = await publishStory(writer, title);

  await signInWithMagicLink(reader, "en");
  await reader.goto(storyUrl);
  await reader.getByRole("complementary", { name: "About the writer" }).getByTestId("follow-button").click();
  await expect(reader.getByRole("complementary", { name: "About the writer" })).toContainText("1 follower");

  // Weekly summaries are on by default, on a weekday the reader is told about.
  await writer.goto("/en/settings/notifications");
  await expect(writer.getByRole("radio", { name: /Weekly summary/ })).toBeChecked();
  await expect(writer.getByRole("main")).toContainText(/Yours arrives on (Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)days\./);
  await expect(writer.getByRole("main")).toContainText("only emails you sign-in links");
  expect(await axeSerious(writer)).toEqual([]);

  await makeDueToday(writerEmail);
  const run = await request.get("/api/cron/notification-emails", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(run.status()).toBe(200);
  expect((await run.json()).sent).toBeGreaterThanOrEqual(1);

  const message = await waitForSummary(writerEmail);
  // The new follower, plus the Kindling badge the writer's first story earned.
  expect(message.Subject).toBe("2 new notifications on Fogata");
  expect(message.Text).toContain("started following you");
  expect(message.Text).toContain("You earned the Kindling badge");
  expect(message.Text).toContain("once a week at most");
  const headers = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}/headers`)).json()) as Record<string, string[]>;
  expect(headers["List-Unsubscribe-Post"]?.[0]).toBe("List-Unsubscribe=One-Click");
  const oneClick = /<([^>]+)>/.exec(headers["List-Unsubscribe"]?.[0] ?? "")?.[1];
  expect(oneClick).toBeTruthy();

  // The footer link opens a confirm page (works signed out too).
  const pageHref = /href="([^"]*\/en\/email\/unsubscribe\?token=[^"]*)"/.exec(message.HTML)?.[1];
  expect(pageHref).toBeTruthy();
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto(localPath(pageHref!));
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Stop summary emails?");
  expect(await axeSerious(visitor)).toEqual([]);
  await visitor.getByTestId("confirm-unsubscribe").click();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("You're unsubscribed");

  await writer.reload();
  await expect(writer.getByRole("radio", { name: /Off/ })).toBeChecked();

  // Turn them back on, then use the one-click header link the way a mail client does.
  await writer.getByRole("radio", { name: /Weekly summary/ }).check();
  await writer.getByTestId("email-settings-save").click();
  await expect(writer.getByTestId("email-settings-saved")).toBeVisible();
  const post = await request.post(localPath(oneClick!), {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(post.status()).toBe(200);
  await writer.reload();
  await expect(writer.getByRole("radio", { name: /Off/ })).toBeChecked();

  // Tampered tokens do nothing.
  const bad = await request.post("/api/email/unsubscribe?token=abc.def", { form: { "List-Unsubscribe": "One-Click" } });
  expect(bad.status()).toBe(400);
  await visitor.goto("/en/email/unsubscribe?token=abc.def");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("This link doesn't work");

  await deleteFromMyStories(writer, title);
  await anonymous.close();
  await writerContext.close();
  await readerContext.close();
});
