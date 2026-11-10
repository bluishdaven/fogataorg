import { storyImagePrefix } from "./stories";
import { isUnsplashImageUrl, unsplashImageUrl, type ImageCredit } from "./unsplash";

/**
 * Shared rules for the share images drawn in the browser (story and circle "Stories" images,
 * quote cards). Pure, so the canvas code only draws.
 */

/** How much of the story's opening the Stories image shows: short, medium or long. */
export const PREVIEW_LENGTHS = ["s", "m", "l"] as const;
export type PreviewLength = (typeof PREVIEW_LENGTHS)[number];

/** The most preview lines each length asks for; the layout shows fewer when the space runs out. */
export const PREVIEW_LINES: Record<PreviewLength, number> = { s: 3, m: 6, l: 12 };

/** Characters of the story's opening to hand the image: enough for the longest preview. */
export const PREVIEW_SOURCE_CHARS = 1200;

/**
 * Preview lines that fit: the length's maximum, capped by the room left (`available` pixels, each
 * line `leading` tall after a `gap`). Fewer than two lines isn't worth showing.
 */
export function previewLinesThatFit(length: PreviewLength, available: number, leading: number, gap: number): number {
  const room = Math.floor((available - gap) / leading);
  const lines = Math.min(PREVIEW_LINES[length], room);
  return lines >= 2 ? lines : 0;
}

/** A picture the canvas may draw, and whose credit to print under it. */
export type DrawableImage = { url: string; credit: string | null };

/**
 * A cover or header the share image can include: uploads from our bucket as they are, and
 * Unsplash photos loaded from Unsplash itself (hotlinked, resized) with the photographer credited,
 * the way design apps export Unsplash photos in people's designs. Anything else: none.
 */
export function drawableImage(url: string | null, credit: ImageCredit | null, supabaseUrl: string): { url: string; photographer: string | null } | null {
  if (!url) return null;
  if (isUnsplashImageUrl(url)) return { url: unsplashImageUrl(url, { width: 1200, quality: 80 }), photographer: credit?.authorName ?? "Unsplash" };
  if (supabaseUrl && url.startsWith(storyImagePrefix(supabaseUrl))) return { url, photographer: null };
  return null;
}

/** "#rrggbb" + alpha → "rgba(r, g, b, a)" for canvas colors. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Quote cards come as a feed post (4:5) or a Story (9:16, Instagram's safe zones kept clear). */
export const QUOTE_FORMATS = ["post", "story"] as const;
export type QuoteFormat = (typeof QUOTE_FORMATS)[number];

export const QUOTE_LAYOUTS: Record<
  QuoteFormat,
  {
    width: number;
    height: number;
    margin: number;
    brandY: number;
    top: number;
    bottom: number;
    urlY: number;
    coverMax: number;
    coverMin: number;
    /** The largest the passage gets (short passages fill the taller Story frame). */
    quoteMax: number;
  }
> = {
  post: { width: 1080, height: 1350, margin: 104, brandY: 96, top: 230, bottom: 1350 - 170, urlY: 1350 - 96, coverMax: 380, coverMin: 220, quoteMax: 84 },
  story: { width: 1080, height: 1920, margin: 96, brandY: 196, top: 340, bottom: 1920 - 470, urlY: 1920 - 380, coverMax: 520, coverMin: 260, quoteMax: 104 },
};
