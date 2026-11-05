/**
 * Reads emails from the local Supabase Mailpit inbox (http://127.0.0.1:54324).
 * Only ever points at the local stack.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSummary = { ID: string; Created: string };

/** The newest sign-in link sent to `email`; pass `since` (ms) to ignore links sent before it. */
export async function waitForMagicLink(email: string, timeoutMs = 15_000, since = 0): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: MailpitSummary[] };
      const latest = messages
        .filter((message) => Date.parse(message.Created) >= since)
        .sort((a, b) => b.Created.localeCompare(a.Created))[0];
      if (latest) {
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json()) as { HTML: string };
        const href = /href="([^"]*token_hash=[^"]*)"/.exec(message.HTML)?.[1];
        if (href) return href.replaceAll("&amp;", "&");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No magic link email for ${email} within ${timeoutMs}ms`);
}
