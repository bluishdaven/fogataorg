import { fitTitle, readableProfileUrl, wrapLines } from "@/lib/domain/story-card";
import { EMBER, EMBER_TEXT, FLAME_INNER, FLAME_OUTER, fontFamily, GLOW, INK, MUTED, PAPER } from "./story-image";

/**
 * Draws a quote card in the browser: 1080×1350 (portrait, fits feeds and chats), the passage in
 * the site's serif, who wrote it and which story, and where to read it. Same paper and glow as
 * the Stories image; uses the fonts the page already loaded.
 */

export type QuoteImageInput = {
  quote: string;
  author: string;
  title: string;
  url: string;
  lang: string;
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

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.15, H + 200, 0, W * 0.15, H + 200, 1100);
  glow.addColorStop(0, "rgba(232, 89, 12, 0.32)");
  glow.addColorStop(0.5, "rgba(232, 89, 12, 0.1)");
  glow.addColorStop(1, "rgba(232, 89, 12, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand.
  const flameScale = 1.4;
  ctx.save();
  ctx.translate(M, 96);
  ctx.scale(flameScale, flameScale);
  ctx.fillStyle = EMBER;
  ctx.fill(new Path2D(FLAME_OUTER));
  ctx.fillStyle = GLOW;
  ctx.fill(new Path2D(FLAME_INNER));
  ctx.restore();
  ctx.fillStyle = PAPER;
  ctx.font = `600 42px ${serif}`;
  ctx.fillText("Fogata", M + 32 * flameScale + 16, 96 + 40 * flameScale - 12);

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

  ctx.fillStyle = PAPER;
  ctx.font = `400 ${quote.size}px ${serif}`;
  for (const line of quote.lines) {
    y += leading;
    ctx.fillText(line, M, y - Math.round(quote.size * 0.28));
  }

  // Who and where.
  y += 64;
  ctx.fillStyle = EMBER;
  ctx.fillRect(M, y - 14, 56, 4);
  ctx.fillStyle = PAPER;
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(wrapLines(input.author, textWidth - 76, (text) => ctx.measureText(text).width, 1)[0] ?? "", M + 76, y);
  y += 44;
  ctx.fillStyle = MUTED;
  ctx.font = `italic 400 36px ${serif}`;
  for (const line of titleLines) {
    y += 48;
    ctx.fillText(line, M, y - 14);
  }

  ctx.fillStyle = EMBER_TEXT;
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(readableProfileUrl(input.url), M, H - 96);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the card"))), "image/png"));
}
