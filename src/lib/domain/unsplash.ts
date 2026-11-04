import { z } from "zod";

/**
 * Rules for using Unsplash photos, from the Unsplash API guidelines:
 * - Hotlink: always load images from the URLs the API returns (images.unsplash.com),
 *   resizing via query params on `urls.raw` and keeping its `ixid` param.
 * - Trigger a download (GET /photos/:id/download) when a writer picks a photo.
 * - Credit the photographer and Unsplash, linking both with our UTM params.
 * - Keep the access key on the server (see src/lib/unsplash/).
 */

export const UNSPLASH_APP_NAME = "fogata";
const UNSPLASH_IMAGE_HOST = "images.unsplash.com";
const UNSPLASH_SITE_HOST = "unsplash.com";

export const unsplashPhotoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/);

const httpsOnHost = (host: string) =>
  z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host;
  });

/** The subset of Unsplash's photo object we rely on. Anything else is ignored. */
export const unsplashApiPhotoSchema = z.object({
  id: unsplashPhotoIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  color: z.string().nullish(),
  blur_hash: z.string().nullish(),
  description: z.string().nullish(),
  alt_description: z.string().nullish(),
  urls: z.object({ raw: httpsOnHost(UNSPLASH_IMAGE_HOST) }),
  links: z.object({ html: httpsOnHost(UNSPLASH_SITE_HOST) }),
  user: z.object({
    name: z.string().min(1),
    username: z.string().min(1),
    links: z.object({ html: httpsOnHost(UNSPLASH_SITE_HOST) }),
  }),
});
export type UnsplashApiPhoto = z.infer<typeof unsplashApiPhotoSchema>;

export type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  /** Dominant color, used as a placeholder while the image loads. */
  color: string | null;
  alt: string;
  rawUrl: string;
  photoUrl: string;
  author: { name: string; username: string; profileUrl: string };
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeUnsplashPhoto(photo: UnsplashApiPhoto): UnsplashPhoto {
  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    color: photo.color && HEX_COLOR.test(photo.color) ? photo.color : null,
    alt: (photo.alt_description || photo.description || "").trim().slice(0, 300),
    rawUrl: photo.urls.raw,
    photoUrl: photo.links.html,
    author: { name: photo.user.name, username: photo.user.username, profileUrl: photo.user.links.html },
  };
}

/** Parses a search results array, dropping any item that doesn't match the expected shape. */
export function parseUnsplashResults(results: unknown): UnsplashPhoto[] {
  if (!Array.isArray(results)) return [];
  return results.flatMap((item) => {
    const parsed = unsplashApiPhotoSchema.safeParse(item);
    return parsed.success ? [normalizeUnsplashPhoto(parsed.data)] : [];
  });
}

export function isUnsplashImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === UNSPLASH_IMAGE_HOST;
  } catch {
    return false;
  }
}

/**
 * A resized version of an Unsplash image, still served by Unsplash (hotlinking).
 * Existing params such as `ixid` are kept.
 */
export function unsplashImageUrl(rawUrl: string, options: { width: number; quality?: number }): string {
  const url = new URL(rawUrl);
  url.searchParams.set("w", String(Math.round(options.width)));
  url.searchParams.set("q", String(options.quality ?? 75));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}

/** Adds the referral params Unsplash asks for on every link back to their site. */
export function withUnsplashUtm(value: string): string {
  const url = new URL(value);
  url.searchParams.set("utm_source", UNSPLASH_APP_NAME);
  url.searchParams.set("utm_medium", "referral");
  return url.toString();
}

export const UNSPLASH_HOME_URL = withUnsplashUtm("https://unsplash.com/");

/** Stored next to an image (story covers, inline images) so it can always be credited. */
export const imageCreditSchema = z.object({
  source: z.literal("unsplash"),
  photoId: unsplashPhotoIdSchema,
  authorName: z.string().min(1).max(120),
  authorUrl: httpsOnHost(UNSPLASH_SITE_HOST),
  photoUrl: httpsOnHost(UNSPLASH_SITE_HOST),
});
export type ImageCredit = z.infer<typeof imageCreditSchema>;

export function creditFromPhoto(photo: UnsplashPhoto): ImageCredit {
  return {
    source: "unsplash",
    photoId: photo.id,
    authorName: photo.author.name.slice(0, 120),
    authorUrl: photo.author.profileUrl,
    photoUrl: photo.photoUrl,
  };
}

export const unsplashSearchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(100)
    // One cache entry per distinct search, regardless of case or spacing.
    .transform((value) => value.toLowerCase().replace(/\s+/g, " ")),
  page: z.coerce.number().int().min(1).max(50).default(1),
  locale: z.enum(["en", "es"]).default("en"),
});

export type UnsplashSearchResult = { photos: UnsplashPhoto[]; totalPages: number };

export type UnsplashSearchError = "unauthorized" | "not_configured" | "invalid" | "rate_limited" | "upstream";

/** Body of GET /api/unsplash/search. */
export type UnsplashSearchResponse = UnsplashSearchResult | { error: UnsplashSearchError };
