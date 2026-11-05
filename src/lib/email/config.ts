import "server-only";

/**
 * Email secrets, read lazily so pages that never send email don't need them.
 * EMAIL_SIGNING_SECRET signs unsubscribe links; rotating it breaks links in
 * emails already sent (they fall back to "sign in and change your settings").
 * CRON_SECRET is the bearer token Vercel Cron sends to the summary route.
 */

export function emailSigningSecret(): string | null {
  return process.env.EMAIL_SIGNING_SECRET?.trim() || null;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}
