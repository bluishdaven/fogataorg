import "server-only";
import { connection } from "next/server";

/**
 * Optional public settings read on the server for each request and handed to the page as props,
 * instead of `process.env.NEXT_PUBLIC_*` (which the bundler freezes at build time, and only when
 * the build can see the variable; Vercel variables can be runtime-only). The lookup goes through
 * a variable name on purpose, so nothing inlines it.
 */

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function googleSignInEnabled(): boolean {
  return read("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED") === "true";
}

export function turnstileSiteKey(): string | undefined {
  return read("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}

export function vapidPublicKey(): string | undefined {
  return read("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
}

export function vapidPrivateKey(): string | undefined {
  return read("VAPID_PRIVATE_KEY");
}

/** For server components: waits for the request first, so prerendering never bakes these in. */
export async function requestPublicConfig() {
  await connection();
  return { googleEnabled: googleSignInEnabled(), turnstileSiteKey: turnstileSiteKey(), vapidPublicKey: vapidPublicKey() };
}
