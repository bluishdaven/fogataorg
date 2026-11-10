import { QUOTE_LAYOUTS, type QuoteFormat } from "@/lib/domain/share-image";
import { fitToHeight, readableProfileUrl, wrapLines } from "@/lib/domain/story-card";
import { accentPalette, DARK_PALETTE, EMBER_TEXT, fontFamily, loadImage, paintBackground, paintBrand, paintPicture, toPng } from "./story-image";

/**
 * Draws a quote card in the browser: a feed post (1080×1350) or a Story (1080×1920, safe zones
 * clear), the passage in the site's serif as large as it fits, who wrote it and which story, and
 * where to read it. Optionally the story's cover as a banner above the passage (credited when it's
 * from Unsplash). Same paper and glow as the Stories image, or the story's own color when the writer
 * chose one; uses the fonts the page already loaded.
 */

export type QuoteImageInput = {
  quote: string;
  author: string;
  title: string;
  url: string;
  lang: string;
  /** The story's color, if the writer chose one. */
  accent: string | null;
  /** The cover, when it can be drawn, with its credit line already in the story's language. */
  cover: { url: string; credit: string | null } | null;
};

/** What whoever shares picks in the image dialog. */
export type QuoteImageOptions = { format: QuoteFormat; cover: boolean; accent: boolean };

export const DEFAULT_QUOTE_IMAGE_OPTIONS: QuoteImageOptions = { format: "post", cover: false, accent: true };

/** The passage reads well down to this size; below it, the cover shrinks first. */
const COMFORTABLE_QUOTE_SIZE = 52;

export async function renderQuoteImage(input: QuoteImageInput, options: QuoteImageOptions = DEFAULT_QUOTE_IMAGE_OPTIONS): Promise<Blob> {
  const layout = QUOTE_LAYOUTS[options.format];
  const { width: W, height: H, margin: M } = layout;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  const [cover] = await Promise.all([
    options.cover && input.cover ? loadImage(input.cover.url) : Promise.resolve(null),
    Promise.all([
      document.fonts.load(`400 64px ${serif}`),
      document.fonts.load(`italic 400 34px ${serif}`),
      document.fonts.load(`600 34px ${sans}`),
    ]).catch(() => undefined),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.textBaseline = "alphabetic";
  (ctx as CanvasRenderingContext2D & { lang?: string }).lang = input.lang;

  const palette = options.accent && input.accent ? accentPalette(input.accent) : DARK_PALETTE;
  paintBackground(ctx, palette, W, H);
  paintBrand(ctx, palette, serif, M, layout.brandY, 1.4, 42);

  const textWidth = W - M * 2;
  const text = `“${input.quote.replace(/\s+/g, " ").trim()}”`;
  const measureAt = (size: number) => {
    ctx.font = `400 ${size}px ${serif}`;
    return (value: string) => ctx.measureText(value).width;
  };
  const fit = (height: number) => fitToHeight(text, textWidth, height, measureAt, { max: layout.quoteMax });
  ctx.font = `italic 400 36px ${serif}`;
  const titleLines = wrapLines(input.title, textWidth, (value) => ctx.measureText(value).width, 2);
  const attributionHeight = 64 + 44 + titleLines.length * 48;
  const credit = cover && input.cover?.credit ? input.cover.credit : "";
  const coverExtras = cover ? (credit ? 46 : 0) + 56 : 0;

  // The passage comes first: the cover starts tall and gives way until the passage reads comfortably.
  let coverHeight = 0;
  let quote = fit(layout.bottom - layout.top - attributionHeight);
  if (cover) {
    for (coverHeight = layout.coverMax; coverHeight >= layout.coverMin; coverHeight -= 40) {
      quote = fit(layout.bottom - layout.top - attributionHeight - coverHeight - coverExtras);
      if (quote.size >= COMFORTABLE_QUOTE_SIZE) break;
    }
    coverHeight = Math.max(coverHeight, layout.coverMin);
  }
  const coverBlock = cover ? coverHeight + coverExtras : 0;
  const blockHeight = coverBlock + quote.lines.length * quote.leading + attributionHeight;
  let y = Math.max(layout.top, layout.top + (layout.bottom - layout.top - blockHeight) / 2);

  if (cover) {
    paintPicture(ctx, cover, M, y, textWidth, coverHeight, 24);
    y += coverHeight;
    if (credit) {
      ctx.fillStyle = palette.muted;
      ctx.font = `400 24px ${sans}`;
      ctx.fillText(wrapLines(credit, textWidth, (value) => ctx.measureText(value).width, 1)[0] ?? "", M, y + 36);
      y += 46;
    }
    y += 56;
  }

  ctx.fillStyle = palette.text;
  ctx.font = `400 ${quote.size}px ${serif}`;
  for (const line of quote.lines) {
    y += quote.leading;
    ctx.fillText(line, M, y - Math.round(quote.size * 0.28));
  }

  // Who and where.
  y += 64;
  ctx.fillStyle = palette.rule;
  ctx.fillRect(M, y - 14, 56, 4);
  ctx.fillStyle = palette.text;
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(wrapLines(input.author, textWidth - 76, (value) => ctx.measureText(value).width, 1)[0] ?? "", M + 76, y);
  y += 44;
  ctx.fillStyle = palette.muted;
  ctx.font = `italic 400 36px ${serif}`;
  for (const line of titleLines) {
    y += 48;
    ctx.fillText(line, M, y - 14);
  }

  ctx.fillStyle = options.accent && input.accent ? palette.text : EMBER_TEXT;
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(readableProfileUrl(input.url), M, layout.urlY);

  return toPng(canvas);
}
