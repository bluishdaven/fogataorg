/**
 * Share-preview (Open Graph) rules shared by the image routes and page metadata. Pure, so it's
 * unit tested; rendering lives in src/lib/og/.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Short, stable fingerprint of what a preview shows, used as `?v=` so edits get a fresh image. */
export function previewVersion(...parts: (string | number | null | undefined)[]): string {
  // FNV-1a, 32-bit: plenty to tell versions of one preview apart.
  let hash = 0x811c9dc5;
  for (const char of parts.map((part) => String(part ?? "")).join("␟")) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** Cuts text at a word boundary near `max` characters, adding an ellipsis when it had to cut. */
export function clampText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

export const ogPaths = {
  site: (locale: string) => `/api/og/site?locale=${locale}`,
  story: (handle: string, slug: string, version: string) =>
    `/api/og/story/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}?v=${version}`,
  profile: (handle: string, version: string) => `/api/og/profile/${encodeURIComponent(handle)}?v=${version}`,
};

/** Shared caches may keep a preview for a day and serve a stale one while refreshing. */
export const OG_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
