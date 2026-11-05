import "server-only";
import { Resend } from "resend";

/**
 * Sends one email. Production uses Resend (RESEND_API_KEY). Without a key,
 * local development delivers to Mailpit (MAILPIT_URL) so nothing reaches a
 * real inbox. With neither, sending fails loudly instead of silently dropping.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendEmail = (email: OutgoingEmail) => Promise<{ id: string }>;

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("No email transport: set RESEND_API_KEY (production) or MAILPIT_URL (local)");
    this.name = "EmailNotConfiguredError";
  }
}

function fromAddress(): { email: string; name: string; header: string } {
  const header = process.env.EMAIL_FROM?.trim() || "Fogata <hola@fogata.test>";
  const match = /^(.*)<([^>]+)>$/.exec(header);
  return { header, name: match?.[1]?.trim() || "Fogata", email: (match?.[2] ?? header).trim() };
}

let resend: Resend | undefined;

// Resend's default rate limit is 2 requests per second per team; space sends out.
const RESEND_MIN_GAP_MS = 550;
let nextResendAt = 0;

async function waitForResendSlot() {
  const now = Date.now();
  const at = Math.max(now, nextResendAt);
  nextResendAt = at + RESEND_MIN_GAP_MS;
  if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now));
}

export const sendEmail: SendEmail = async (email) => {
  const from = fromAddress();
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (apiKey) {
    resend ??= new Resend(apiKey);
    await waitForResendSlot();
    const { data, error } = await resend.emails.send({
      from: from.header,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    });
    if (error || !data) throw new Error(`Resend failed: ${error?.message ?? "no response"}`);
    return { id: data.id };
  }

  const mailpit = process.env.MAILPIT_URL?.trim();
  if (mailpit) {
    const response = await fetch(new URL("/api/v1/send", mailpit), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: from.email, Name: from.name },
        To: [{ Email: email.to }],
        Subject: email.subject,
        HTML: email.html,
        Text: email.text,
        Headers: email.headers ?? {},
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Mailpit failed: ${response.status}`);
    const body = (await response.json()) as { ID?: string };
    return { id: body.ID ?? "mailpit" };
  }

  throw new EmailNotConfiguredError();
};
