import type { MetadataRoute } from "next";

/**
 * Fogata as an installable web app (docs/plans/app.md): the manifest, and the rules the service
 * worker and pages share about what a device keeps offline.
 */

export const APP_THEME = { light: "#faf6ee", dark: "#0a0d14" } as const;

/** One manifest for both languages: `start_url` goes through the proxy, which picks the reader's. */
export const APP_MANIFEST: MetadataRoute.Manifest = {
  id: "/",
  name: "Fogata",
  short_name: "Fogata",
  description: "Long-form stories in English and Spanish. Historias largas en español e inglés.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: APP_THEME.light,
  theme_color: APP_THEME.light,
  categories: ["books", "news", "social"],
  icons: [
    { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  // Unprefixed: the proxy sends them to the reader's language.
  shortcuts: [
    { name: "Saved · Guardadas", url: "/me/saved", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    { name: "Write · Escribir", url: "/write", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    { name: "Offline · Sin conexión", url: "/offline", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
  ],
};

/** The service worker's caches. Bump a name when its contents' shape changes. */
export const OFFLINE_CACHE = "fogata-offline-v1";

/** This device's list of downloaded stories (localStorage), newest first. */
export const OFFLINE_LIST_KEY = "fogata:offline";

/** How many saved stories "Keep saved stories offline" downloads. */
export const OFFLINE_SAVED_LIMIT = 50;

export type OfflineStory = { url: string; title: string; author: string; savedAt: string };

/** Reads the stored list, dropping anything malformed (it's the browser's storage, anything goes). */
export function parseOfflineList(raw: string | null): OfflineStory[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is OfflineStory =>
        typeof item === "object" &&
        item !== null &&
        typeof item.url === "string" &&
        item.url.startsWith("/@") &&
        typeof item.title === "string" &&
        typeof item.author === "string" &&
        typeof item.savedAt === "string",
    );
  } catch {
    return [];
  }
}

/** Adds or refreshes a story at the top of the list. */
export function withOfflineStory(list: OfflineStory[], story: OfflineStory): OfflineStory[] {
  return [story, ...list.filter((item) => item.url !== story.url)];
}

/**
 * The `/_next/static/…` files a downloaded page needs (scripts, styles, fonts), as site paths
 * (`/_next/static/immutable/…` on Vercel).
 * Pages name them both as attributes (`/_next/static/chunks/a.js`) and inside the inline RSC
 * payload, sometimes without the `/_next/` prefix or with escaped slashes.
 */
export function staticAssetPaths(html: string): string[] {
  const found = new Set<string>();
  const pattern = /(?:\/_next\/)?static\/(?:immutable\/)?(?:chunks|css|media)\/[A-Za-z0-9._~\-/%@[\]]+?\.(?:js|css|woff2?|ttf|otf|png|svg|webp|jpe?g)/g;
  for (const match of html.replaceAll("\\/", "/").matchAll(pattern)) {
    const value = match[0].startsWith("/_next/") ? match[0] : `/_next/${match[0]}`;
    found.add(value);
    // Some bundler chunk names have brackets, written raw in one place and encoded in another;
    // the browser asks for whichever spelling it read, so keep both.
    const encoded = value.replaceAll("[", "%5B").replaceAll("]", "%5D");
    const decoded = value.replaceAll("%5B", "[").replaceAll("%5D", "]");
    if (encoded !== value) found.add(encoded);
    if (decoded !== value) found.add(decoded);
  }
  return [...found];
}

/** Pictures in a downloaded page worth keeping too: `<img src>` on http(s), deduplicated. */
export function imageUrls(html: string, limit = 40): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)) {
    const src = match[1]?.replaceAll("&amp;", "&");
    if (src && /^https?:\/\//.test(src)) found.add(src);
    if (found.size >= limit) break;
  }
  return [...found];
}
