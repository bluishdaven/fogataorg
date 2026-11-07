import { createHmac } from "node:crypto";

/** A read counts (in `story_heat()` and, later, writer stats) once the reader got past half the story. */
export const READ_THRESHOLD = 0.5;

/**
 * The anonymous reader key stored with a read: an HMAC of the UTC day and the person (their user
 * id, or their IP when signed out). It changes every day, so one reader's days can't be linked,
 * and the IP itself is never stored.
 */
export function readerHash(secret: string, day: string, identity: string): string {
  return createHmac("sha256", `reads:${secret}`).update(`${day}|${identity}`).digest("hex").slice(0, 40);
}

/** Crawlers and link previews that run scripts shouldn't count as readers. */
export function looksAutomated(userAgent: string | null): boolean {
  return !userAgent || /bot|crawl|spider|slurp|preview|lighthouse|facebookexternalhit/i.test(userAgent);
}
