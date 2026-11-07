/**
 * Pure helpers for a circle's "Stories" share image (same 1080×1920 canvas as stories, see
 * story-card.ts). The canvas code lives in components/circles/circle-image.ts.
 */

/** The address to share: unprefixed, so each visitor lands in their own language. */
export function circleShareUrl(siteUrl: string, slug: string): string {
  return new URL(`/circles/${encodeURIComponent(slug.toLowerCase())}`, siteUrl).toString();
}

/** "https://fogata.org/en/circles/agua" → "fogata.org/circles/agua", short enough to read off a screen. */
export function readableCircleUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/(en|es)(?=\/)/, "").replace(/\/$/, "");
    return `${parsed.host.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

/** Safe file name for the downloaded image. */
export function circleImageFileName(slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `fogata-circle-${safe || "circle"}.png`;
}

/**
 * How many of the latest stories fit in the space left: each takes `itemHeight`, and the list
 * needs `headingHeight` once it has any. At most `max`.
 */
export function storiesThatFit(available: number, itemHeight: number, headingHeight: number, count: number, max = 3): number {
  const room = Math.floor((available - headingHeight) / itemHeight);
  return Math.max(0, Math.min(count, max, room));
}
