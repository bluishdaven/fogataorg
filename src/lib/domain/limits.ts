/**
 * How often people can do things, so a script or a burst of spam can't flood Fogata. Brand-new
 * accounts (their first day) get tighter limits while they're unknown. Windows are Postgres
 * intervals; take_rate_limit() enforces them.
 */

export const NEW_ACCOUNT_HOURS = 24;

export type LimitedAction = "publish" | "respond" | "createCircle" | "joinRequest" | "follow" | "photoSearch" | "signInLink" | "highlight" | "importStory";

export type Limit = { max: number; per: "1 hour" | "1 day" };

export const LIMITS: Record<LimitedAction, { regular: Limit; newAccount?: Limit }> = {
  // First publishes only; edits to a live story aren't counted.
  publish: { regular: { max: 12, per: "1 hour" }, newAccount: { max: 5, per: "1 day" } },
  respond: { regular: { max: 40, per: "1 hour" }, newAccount: { max: 20, per: "1 day" } },
  createCircle: { regular: { max: 5, per: "1 day" }, newAccount: { max: 2, per: "1 day" } },
  joinRequest: { regular: { max: 20, per: "1 day" }, newAccount: { max: 10, per: "1 day" } },
  follow: { regular: { max: 120, per: "1 hour" }, newAccount: { max: 60, per: "1 hour" } },
  // Unsplash's quota is shared by everyone, so one person can't spend it.
  photoSearch: { regular: { max: 20, per: "1 hour" }, newAccount: { max: 10, per: "1 hour" } },
  // Per IP address (hashed): sign-in links cost email quota and can be used to spam inboxes.
  signInLink: { regular: { max: 10, per: "1 hour" } },
  highlight: { regular: { max: 300, per: "1 hour" }, newAccount: { max: 100, per: "1 hour" } },
  importStory: { regular: { max: 300, per: "1 day" }, newAccount: { max: 30, per: "1 day" } },
};

export function isNewAccount(createdAt: Date | null | undefined, now: Date): boolean {
  return !createdAt || now.getTime() - createdAt.getTime() < NEW_ACCOUNT_HOURS * 60 * 60 * 1000;
}

export function limitFor(action: LimitedAction, createdAt: Date | null | undefined, now: Date): Limit {
  const rule = LIMITS[action];
  return rule.newAccount && isNewAccount(createdAt, now) ? rule.newAccount : rule.regular;
}

/** The first address in X-Forwarded-For (set by Vercel), or null when there's none (local runs). */
export function clientIp(forwardedFor: string | null, realIp: string | null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || realIp?.trim() || null;
}

/**
 * Requests from this machine (local development and the e2e suite) skip per-address limits:
 * every test signs in from the same address. Behind Vercel the visitor's address is never one.
 */
export function isLoopback(ip: string): boolean {
  const address = ip.toLowerCase().replace(/^::ffff:/, "");
  return address === "::1" || address === "localhost" || /^127\./.test(address);
}
