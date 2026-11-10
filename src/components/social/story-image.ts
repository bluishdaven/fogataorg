import { initials, isAvatarUrl } from "@/lib/domain/avatars";
import { readableTextOn } from "@/lib/domain/circles";
import { PREVIEW_LINES, previewLinesThatFit, withAlpha, type PreviewLength } from "@/lib/domain/share-image";
import { fitTitle, readableProfileUrl, STORY_IMAGE, wrapLines } from "@/lib/domain/story-card";

/**
 * Draws the "Stories" share image in the browser: 1080×1920, the Fogata flame, optionally the
 * story's cover, the title in the site's serif, the writer, a preview of the opening (short,
 * medium or long) and an invitation to read. Warm dark paper by default, or the story's own color
 * (with white or black text, whichever reads). Uses the fonts the page already loaded; pictures
 * come only from our buckets or Unsplash (both CORS-enabled), so the canvas never gets tainted.
 */

export type StoryImageInput = {
  title: string;
  author: string;
  avatarUrl: string | null;
  preview: string;
  /** Copy in the story's language: eyebrow ("A story on Fogata"), reading time, call to action. */
  eyebrow: string;
  readingLabel: string;
  cta: string;
  url: string;
  lang: string;
  /** The story's color, if the writer chose one. */
  accent: string | null;
  /** The cover, when it can be drawn, with its credit line already in the story's language. */
  cover: { url: string; credit: string | null } | null;
};

/** What whoever shares picks in the image dialog. */
export type StoryImageOptions = { cover: boolean; preview: PreviewLength; accent: boolean };

export const DEFAULT_STORY_IMAGE_OPTIONS: StoryImageOptions = { cover: true, preview: "m", accent: true };

export const INK = "#1b1814";
export const PAPER = "#f6efe3";
export const MUTED = "#b9ad9b";
const QUOTE = "#ddd2c1";
export const EMBER = "#e8590c";
export const EMBER_TEXT = "#ff9257";
const BUTTON = "#c2410c";
export const GLOW = "#ffd27a";

export const FLAME_OUTER =
  "M16 1c1.2 6.4 6.6 9.6 9.8 15.2 3.6 6.4 2.3 14.4-3.2 18.6A11.5 11.5 0 0 1 4.3 30C1.8 23.8 4.6 18.4 8 15.2c.4 3 1.9 5 4.2 6C10.6 14.4 12.8 6.6 16 1Z";
export const FLAME_INNER =
  "M16.5 17c.6 3.6 3.9 5.4 4.6 9a6.3 6.3 0 0 1-12.2 3.2c-.7-2.9.6-5.3 2.4-6.8.3 1.6 1.1 2.6 2.4 3.1-.6-3.4.8-6.4 2.8-8.5Z";

/** The colors an image is drawn in: Fogata's dark paper, or a writer's or circle's accent. */
export type Palette = {
  background: string;
  /** Faint rings on an accent; an ember glow on the dark paper. */
  texture: "glow" | "rings";
  text: string;
  muted: string;
  quote: string;
  eyebrow: string;
  rule: string;
  ctaBackground: string;
  ctaText: string;
  flameOuter: string;
  flameInner: string;
  avatarBackground: string;
  avatarText: string;
};

export const DARK_PALETTE: Palette = {
  background: INK,
  texture: "glow",
  text: PAPER,
  muted: MUTED,
  quote: QUOTE,
  eyebrow: EMBER_TEXT,
  rule: EMBER,
  ctaBackground: BUTTON,
  ctaText: "#ffffff",
  flameOuter: EMBER,
  flameInner: GLOW,
  avatarBackground: "#fde4d0",
  avatarText: "#b13a0a",
};

/** Text is white or black, whichever reads on the accent; the button swaps the two. */
export function accentPalette(accent: string): Palette {
  const ink = readableTextOn(accent);
  return {
    background: accent,
    texture: "rings",
    text: ink,
    muted: withAlpha(ink, 0.82),
    quote: withAlpha(ink, 0.92),
    eyebrow: withAlpha(ink, 0.85),
    rule: withAlpha(ink, 0.55),
    ctaBackground: ink,
    ctaText: accent,
    flameOuter: ink,
    flameInner: accent,
    avatarBackground: withAlpha(ink, 0.18),
    avatarText: ink,
  };
}

export function fontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // Without CORS the photo is skipped, so the canvas never gets tainted.
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The background: paper with a low ember glow, or the accent with faint rings from a corner. */
export function paintBackground(ctx: CanvasRenderingContext2D, palette: Palette, W: number, H: number) {
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, H);
  if (palette.texture === "glow") {
    const glow = ctx.createRadialGradient(W / 2, H + 260, 0, W / 2, H + 260, 1250);
    glow.addColorStop(0, "rgba(232, 89, 12, 0.34)");
    glow.addColorStop(0.45, "rgba(232, 89, 12, 0.12)");
    glow.addColorStop(1, "rgba(232, 89, 12, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 3;
  for (let ring = 1; ring <= 7; ring += 1) {
    ctx.globalAlpha = 0.09 - ring * 0.008;
    ctx.beginPath();
    ctx.arc(W - 40, H - 260, ring * (H / 9.15), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The flame and "Fogata", at the given top-left corner. */
export function paintBrand(ctx: CanvasRenderingContext2D, palette: Palette, serif: string, x: number, y: number, scale: number, fontSize: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.flameOuter;
  ctx.fill(new Path2D(FLAME_OUTER));
  ctx.fillStyle = palette.flameInner;
  ctx.fill(new Path2D(FLAME_INNER));
  ctx.restore();
  ctx.fillStyle = palette.text;
  ctx.font = `600 ${fontSize}px ${serif}`;
  ctx.fillText("Fogata", x + 32 * scale + 18, y + 40 * scale - 14);
}

/** A picture cover-cropped into a rounded frame. */
export function paintPicture(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, radius: number) {
  const frameRatio = w / h;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const sw = imageRatio > frameRatio ? image.naturalHeight * frameRatio : image.naturalWidth;
  const sh = imageRatio > frameRatio ? image.naturalHeight : image.naturalWidth / frameRatio;
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"),
  );
}

export async function renderStoryImage(input: StoryImageInput, options: StoryImageOptions = DEFAULT_STORY_IMAGE_OPTIONS): Promise<Blob> {
  const { width: W, height: H, margin: M } = STORY_IMAGE;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const palette = options.accent && input.accent ? accentPalette(input.accent) : DARK_PALETTE;

  const [avatar, cover] = await Promise.all([
    supabaseUrl && isAvatarUrl(input.avatarUrl, supabaseUrl) ? loadImage(input.avatarUrl) : Promise.resolve(null),
    options.cover && input.cover ? loadImage(input.cover.url) : Promise.resolve(null),
    Promise.all([
      document.fonts.load(`600 96px ${serif}`),
      document.fonts.load(`italic 400 40px ${serif}`),
      document.fonts.load(`600 36px ${sans}`),
      document.fonts.load(`400 30px ${sans}`),
    ]).catch(() => undefined),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.textBaseline = "alphabetic";
  // Newer browsers use the language for text shaping; TypeScript's DOM types don't know it yet.
  (ctx as CanvasRenderingContext2D & { lang?: string }).lang = input.lang;

  paintBackground(ctx, palette, W, H);
  // Brand, inside the top safe zone.
  paintBrand(ctx, palette, serif, M, 196, 1.7, 48);

  // Measure everything first, so the block can sit in the optical middle.
  const textWidth = W - M * 2;
  const top = cover ? 330 : 360;
  const bottom = H - 470;
  const credit = cover && input.cover?.credit ? input.cover.credit : "";

  const measureAt = (size: number) => {
    ctx.font = `600 ${size}px ${serif}`;
    return (text: string) => ctx.measureText(text).width;
  };
  const title = fitTitle(input.title, textWidth, measureAt, cover ? { max: 84, min: 56, maxLines: 3 } : { max: 100, min: 64, maxLines: 5 });
  const titleLeading = Math.round(title.size * 1.14);
  const eyebrowHeight = 30 + 44;
  const titleHeight = title.lines.length * titleLeading;
  const authorHeight = 56 + 84;

  const quoteIndent = 40;
  const previewLeading = 64;
  const previewGap = 72;
  ctx.font = `italic 400 42px ${serif}`;
  const measurePreview = (text: string) => ctx.measureText(text).width;
  // The opening as it would wrap at the chosen length, before the space decides.
  const wanted = input.preview ? wrapLines(input.preview, textWidth - quoteIndent, measurePreview, PREVIEW_LINES[options.preview]).length : 0;
  const textRoom = bottom - top - eyebrowHeight - titleHeight - authorHeight;
  // The cover gives way to the preview: full height with a short one, a banner with a long one.
  const coverExtras = cover ? (credit ? 50 : 0) + 56 : 0;
  const coverHeight = cover
    ? Math.round(Math.min(500, Math.max(240, textRoom - coverExtras - (wanted ? previewGap + wanted * previewLeading : 0))))
    : 0;
  const coverBlock = cover ? coverHeight + coverExtras : 0;
  const lineCount = wanted ? Math.min(wanted, previewLinesThatFit(options.preview, textRoom - coverBlock, previewLeading, previewGap)) : 0;
  const previewLines = lineCount ? wrapLines(input.preview, textWidth - quoteIndent, measurePreview, lineCount) : [];

  const previewHeight = previewLines.length ? previewGap + previewLines.length * previewLeading : 0;
  const blockHeight = coverBlock + eyebrowHeight + titleHeight + authorHeight + previewHeight;
  let y = Math.max(top, top + (bottom - top - blockHeight) / 2);

  // Cover, with its photographer under it.
  if (cover) {
    paintPicture(ctx, cover, M, y, textWidth, coverHeight, 28);
    y += coverHeight;
    if (credit) {
      ctx.fillStyle = palette.muted;
      ctx.font = `400 24px ${sans}`;
      ctx.fillText(wrapLines(credit, textWidth, (t) => ctx.measureText(t).width, 1)[0] ?? "", M, y + 38);
      y += 50;
    }
    y += 56;
  }

  // Eyebrow.
  ctx.fillStyle = palette.eyebrow;
  ctx.font = `600 28px ${sans}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(input.eyebrow.toLocaleUpperCase(input.lang), M, y + 28);
  ctx.letterSpacing = "0px";
  y += eyebrowHeight;

  // Title.
  ctx.fillStyle = palette.text;
  ctx.font = `600 ${title.size}px ${serif}`;
  for (const line of title.lines) {
    y += titleLeading;
    ctx.fillText(line, M, y - Math.round(title.size * 0.22));
  }

  // Writer.
  y += 56;
  const avatarSize = 84;
  ctx.save();
  ctx.beginPath();
  ctx.arc(M + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    const side = Math.min(avatar.naturalWidth, avatar.naturalHeight);
    ctx.drawImage(avatar, (avatar.naturalWidth - side) / 2, (avatar.naturalHeight - side) / 2, side, side, M, y, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = palette.avatarBackground;
    ctx.fillRect(M, y, avatarSize, avatarSize);
    ctx.fillStyle = palette.avatarText;
    ctx.font = `600 32px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText(initials(input.author), M + avatarSize / 2, y + avatarSize / 2 + 11);
    ctx.textAlign = "left";
  }
  ctx.restore();
  const nameX = M + avatarSize + 26;
  ctx.fillStyle = palette.text;
  ctx.font = `600 36px ${sans}`;
  ctx.fillText(wrapLines(input.author, textWidth - avatarSize - 26, (t) => ctx.measureText(t).width, 1)[0] ?? "", nameX, y + 38);
  ctx.fillStyle = palette.muted;
  ctx.font = `400 30px ${sans}`;
  ctx.fillText(input.readingLabel, nameX, y + 78);
  y += avatarSize;

  // Preview, set as a quotation.
  if (previewLines.length) {
    y += previewGap;
    ctx.fillStyle = palette.rule;
    roundedRect(ctx, M, y - 8, 6, previewLines.length * previewLeading - 4, 3);
    ctx.fill();
    ctx.fillStyle = palette.quote;
    ctx.font = `italic 400 42px ${serif}`;
    for (const line of previewLines) {
      ctx.fillText(line, M + quoteIndent, y + 40);
      y += previewLeading;
    }
  }

  // Invitation, above the bottom safe zone.
  const ctaY = H - 400;
  ctx.font = `600 38px ${sans}`;
  const ctaText = `${input.cta}  →`;
  const ctaWidth = Math.min(textWidth, ctx.measureText(ctaText).width + 96);
  ctx.fillStyle = palette.ctaBackground;
  roundedRect(ctx, M, ctaY, ctaWidth, 104, 52);
  ctx.fill();
  ctx.fillStyle = palette.ctaText;
  ctx.fillText(ctaText, M + 48, ctaY + 66);
  ctx.fillStyle = palette.muted;
  ctx.font = `400 32px ${sans}`;
  ctx.fillText(readableProfileUrl(input.url), M, ctaY + 104 + 62);

  return toPng(canvas);
}
