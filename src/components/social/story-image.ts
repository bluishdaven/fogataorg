import { initials, isAvatarUrl } from "@/lib/domain/avatars";
import { fitTitle, readableProfileUrl, STORY_IMAGE, wrapLines } from "@/lib/domain/story-card";

/**
 * Draws the "Stories" share image in the browser: 1080×1920, warm dark paper,
 * the Fogata flame, the title in the site's serif, the writer, a short preview
 * and an invitation to read. Uses the fonts the page already loaded, so nothing
 * is fetched from a server except the writer's photo (our own bucket, CORS-enabled).
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
};

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

export function fontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // Without CORS the photo is skipped, so the canvas never gets tainted.
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderStoryImage(input: StoryImageInput): Promise<Blob> {
  const { width: W, height: H, margin: M } = STORY_IMAGE;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const [avatar] = await Promise.all([
    supabaseUrl && isAvatarUrl(input.avatarUrl, supabaseUrl) ? loadImage(input.avatarUrl) : Promise.resolve(null),
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

  // Paper and a low ember glow, like a fire seen from a few steps away.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H + 260, 0, W / 2, H + 260, 1250);
  glow.addColorStop(0, "rgba(232, 89, 12, 0.34)");
  glow.addColorStop(0.45, "rgba(232, 89, 12, 0.12)");
  glow.addColorStop(1, "rgba(232, 89, 12, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand: flame and wordmark, inside the top safe zone.
  const flameScale = 1.7;
  ctx.save();
  ctx.translate(M, 196);
  ctx.scale(flameScale, flameScale);
  ctx.fillStyle = EMBER;
  ctx.fill(new Path2D(FLAME_OUTER));
  ctx.fillStyle = GLOW;
  ctx.fill(new Path2D(FLAME_INNER));
  ctx.restore();
  ctx.fillStyle = PAPER;
  ctx.font = `600 48px ${serif}`;
  ctx.fillText("Fogata", M + 32 * flameScale + 18, 196 + 40 * flameScale - 14);

  // Content, measured first so the block can sit in the optical middle.
  const textWidth = W - M * 2;
  const measureAt = (size: number) => {
    ctx.font = `600 ${size}px ${serif}`;
    return (text: string) => ctx.measureText(text).width;
  };
  const title = fitTitle(input.title, textWidth, measureAt, { max: 100, min: 64, maxLines: 5 });
  const titleLeading = Math.round(title.size * 1.14);

  ctx.font = `italic 400 42px ${serif}`;
  const quoteIndent = 40;
  const previewLines = input.preview
    ? wrapLines(input.preview, textWidth - quoteIndent, (text) => ctx.measureText(text).width, 6)
    : [];
  const previewLeading = 64;

  const eyebrowHeight = 30 + 44;
  const titleHeight = title.lines.length * titleLeading;
  const authorHeight = 56 + 84;
  const previewHeight = previewLines.length ? 72 + previewLines.length * previewLeading : 0;
  const blockHeight = eyebrowHeight + titleHeight + authorHeight + previewHeight;
  const top = 360;
  const bottom = H - 470;
  let y = Math.max(top, top + (bottom - top - blockHeight) / 2);

  // Eyebrow.
  ctx.fillStyle = EMBER_TEXT;
  ctx.font = `600 28px ${sans}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(input.eyebrow.toLocaleUpperCase(input.lang), M, y + 28);
  ctx.letterSpacing = "0px";
  y += eyebrowHeight;

  // Title.
  ctx.fillStyle = PAPER;
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
    ctx.drawImage(
      avatar,
      (avatar.naturalWidth - side) / 2,
      (avatar.naturalHeight - side) / 2,
      side,
      side,
      M,
      y,
      avatarSize,
      avatarSize,
    );
  } else {
    ctx.fillStyle = "#fde4d0";
    ctx.fillRect(M, y, avatarSize, avatarSize);
    ctx.fillStyle = "#b13a0a";
    ctx.font = `600 32px ${sans}`;
    ctx.textAlign = "center";
    ctx.fillText(initials(input.author), M + avatarSize / 2, y + avatarSize / 2 + 11);
    ctx.textAlign = "left";
  }
  ctx.restore();
  const nameX = M + avatarSize + 26;
  ctx.fillStyle = PAPER;
  ctx.font = `600 36px ${sans}`;
  ctx.fillText(wrapLines(input.author, textWidth - avatarSize - 26, (t) => ctx.measureText(t).width, 1)[0] ?? "", nameX, y + 38);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${sans}`;
  ctx.fillText(input.readingLabel, nameX, y + 78);
  y += avatarSize;

  // Preview, set as a quotation.
  if (previewLines.length) {
    y += 72;
    ctx.fillStyle = EMBER;
    roundedRect(ctx, M, y - 8, 6, previewLines.length * previewLeading - 4, 3);
    ctx.fill();
    ctx.fillStyle = QUOTE;
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
  ctx.fillStyle = BUTTON;
  roundedRect(ctx, M, ctaY, ctaWidth, 104, 52);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(ctaText, M + 48, ctaY + 66);
  ctx.fillStyle = MUTED;
  ctx.font = `400 32px ${sans}`;
  ctx.fillText(readableProfileUrl(input.url), M, ctaY + 104 + 62);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"),
  );
}
