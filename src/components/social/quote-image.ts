import { fitTitle, readableProfileUrl, wrapLines } from "@/lib/domain/story-card";
import { accentPalette, DARK_PALETTE, EMBER_TEXT, fontFamily, paintBackground, paintBrand, toPng } from "./story-image";

/**
 * Draws a quote card in the browser: 1080×1350 (portrait, fits feeds and chats), the passage in
 * the site's serif, who wrote it and which story, and where to read it. Same paper and glow as
 * the Stories image, or the story's own color when the writer chose one; uses the fonts the page
 * already loaded.
 */

export type QuoteImageInput = {
  quote: string;
  author: string;
  title: string;
  url: string;
  lang: string;
  /** The story's color, if the writer chose one. */
  accent: string | null;
};

export const QUOTE_IMAGE = { width: 1080, height: 1350, margin: 104 } as const;

export async function renderQuoteImage(input: QuoteImageInput): Promise<Blob> {
  const { width: W, height: H, margin: M } = QUOTE_IMAGE;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  await Promise.all([
    document.fonts.load(`400 64px ${serif}`),
    document.fonts.load(`italic 400 34px ${serif}`),
    document.fonts.load(`600 34px ${sans}`),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.textBaseline = "alphabetic";
  (ctx as CanvasRenderingContext2D & { lang?: string }).lang = input.lang;

  const palette = input.accent ? accentPalette(input.accent) : DARK_PALETTE;
  paintBackground(ctx, palette, W, H);
  // Brand.
  paintBrand(ctx, palette, serif, M, 96, 1.4, 42);

  // The passage, as large as it fits.
  const textWidth = W - M * 2;
  const quote = fitTitle(`“${input.quote.replace(/\s+/g, " ").trim()}”`, textWidth, (size) => {
    ctx.font = `400 ${size}px ${serif}`;
    return (text: string) => ctx.measureText(text).width;
  }, { max: 84, min: 40, step: 4, maxLines: 13 });
  const leading = Math.round(quote.size * 1.32);

  ctx.font = `italic 400 36px ${serif}`;
  const titleLines = wrapLines(input.title, textWidth, (text) => ctx.measureText(text).width, 2);
  const attributionHeight = 64 + 44 + titleLines.length * 48;
  const blockHeight = quote.lines.length * leading + attributionHeight;
  const top = 250;
  const bottom = H - 190;
  let y = Math.max(top, top + (bottom - top - blockHeight) / 2);

  ctx.fillStyle = palette.text;
  ctx.font = `400 ${quote.size}px ${serif}`;
  for (const line of quote.lines) {
    y += leading;
    ctx.fillText(line, M, y - Math.round(quote.size * 0.28));
  }

  // Who and where.
  y += 64;
  ctx.fillStyle = palette.rule;
  ctx.fillRect(M, y - 14, 56, 4);
  ctx.fillStyle = palette.text;
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(wrapLines(input.author, textWidth - 76, (text) => ctx.measureText(text).width, 1)[0] ?? "", M + 76, y);
  y += 44;
  ctx.fillStyle = palette.muted;
  ctx.font = `italic 400 36px ${serif}`;
  for (const line of titleLines) {
    y += 48;
    ctx.fillText(line, M, y - 14);
  }

  ctx.fillStyle = input.accent ? palette.text : EMBER_TEXT;
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(readableProfileUrl(input.url), M, H - 96);

  return toPng(canvas);
}
