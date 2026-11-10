import { storiesThatFit, readableCircleUrl } from "@/lib/domain/circle-card";
import { fitTitle, STORY_IMAGE, wrapLines } from "@/lib/domain/story-card";
import {
  accentPalette,
  fontFamily,
  loadImage,
  paintBackground,
  paintBrand,
  paintPicture,
  roundedRect,
  toPng,
} from "@/components/social/story-image";

/**
 * Draws a circle's "Stories" share image in the browser (1080×1920, Instagram safe zones): the
 * circle's accent color with soft rings, its header picture (optional; uploads, or Unsplash photos
 * loaded from Unsplash with the photographer credited), the name, what it's about, how many stories
 * and members it has, its latest stories when there's room, and an invitation to read. Text is
 * white or black, whichever reads on the accent (readableTextOn).
 */

export type CircleImageInput = {
  name: string;
  description: string;
  accentColor: string;
  /** The header, when it can be drawn, with its credit line already in the sharer's language. */
  header: { url: string; credit: string | null } | null;
  /** Copy in the sharer's language. */
  eyebrow: string;
  stats: string;
  latestLabel: string;
  latest: { title: string; author: string }[];
  cta: string;
  url: string;
  lang: string;
};

/** What whoever shares picks in the image dialog. */
export type CircleImageOptions = { header: boolean };

export async function renderCircleImage(input: CircleImageInput, options: CircleImageOptions = { header: true }): Promise<Blob> {
  const { width: W, height: H, margin: M } = STORY_IMAGE;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  const palette = accentPalette(input.accentColor);
  const ink = palette.text;

  const [header] = await Promise.all([
    options.header && input.header ? loadImage(input.header.url) : Promise.resolve(null),
    Promise.all([
      document.fonts.load(`600 100px ${serif}`),
      document.fonts.load(`400 40px ${serif}`),
      document.fonts.load(`600 32px ${sans}`),
      document.fonts.load(`400 28px ${sans}`),
    ]).catch(() => undefined),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.textBaseline = "alphabetic";
  (ctx as CanvasRenderingContext2D & { lang?: string }).lang = input.lang;

  paintBackground(ctx, palette, W, H);
  // Brand, inside the top safe zone: the flame cut from the accent so it shows on any color.
  paintBrand(ctx, palette, serif, M, 196, 1.7, 48);

  const textWidth = W - M * 2;
  const top = 360;
  const bottom = H - 470;

  // Measure everything first, so the block can sit in the middle of the space it has.
  const headerHeight = header ? 444 : 0;
  const credit = header && input.header?.credit ? input.header.credit : "";
  const headerGap = header ? 72 + (credit ? 44 : 0) : 0;
  const measureAt = (size: number) => {
    ctx.font = `600 ${size}px ${serif}`;
    return (text: string) => ctx.measureText(text).width;
  };
  const name = fitTitle(input.name, textWidth, measureAt, { max: 112, min: 68, maxLines: 4 });
  const nameLeading = Math.round(name.size * 1.12);
  ctx.font = `400 40px ${serif}`;
  const descriptionLines = input.description
    ? wrapLines(input.description, textWidth, (text) => ctx.measureText(text).width, header ? 3 : 5)
    : [];
  const descriptionLeading = 58;

  const eyebrowHeight = 30 + 44;
  const nameHeight = name.lines.length * nameLeading;
  const descriptionHeight = descriptionLines.length ? 36 + descriptionLines.length * descriptionLeading : 0;
  const statsHeight = 40 + 40;
  const fixedHeight = headerHeight + headerGap + eyebrowHeight + nameHeight + descriptionHeight + statsHeight;
  const itemHeight = 112;
  const listHeading = 64 + 40;
  const shown = storiesThatFit(bottom - top - fixedHeight, itemHeight, listHeading, input.latest.length);
  const blockHeight = fixedHeight + (shown ? listHeading + shown * itemHeight : 0);
  let y = Math.max(top - (header ? 30 : 0), top + (bottom - top - blockHeight) / 2);

  // Header picture, cover-cropped into a rounded frame, with its photographer under it.
  if (header) {
    paintPicture(ctx, header, M, y, textWidth, headerHeight, 32);
    y += headerHeight;
    if (credit) {
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.82;
      ctx.font = `400 24px ${sans}`;
      ctx.fillText(wrapLines(credit, textWidth, (t) => ctx.measureText(t).width, 1)[0] ?? "", M, y + 38);
      ctx.globalAlpha = 1;
      y += 44;
    }
    y += 72;
  }

  // Eyebrow.
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.85;
  ctx.font = `600 28px ${sans}`;
  ctx.letterSpacing = "5px";
  ctx.fillText(input.eyebrow.toLocaleUpperCase(input.lang), M, y + 28);
  ctx.letterSpacing = "0px";
  ctx.globalAlpha = 1;
  y += eyebrowHeight;

  // Name.
  ctx.font = `600 ${name.size}px ${serif}`;
  for (const line of name.lines) {
    y += nameLeading;
    ctx.fillText(line, M, y - Math.round(name.size * 0.2));
  }

  // What it's about.
  if (descriptionLines.length) {
    y += 36;
    ctx.globalAlpha = 0.92;
    ctx.font = `400 40px ${serif}`;
    for (const line of descriptionLines) {
      y += descriptionLeading;
      ctx.fillText(line, M, y - 16);
    }
    ctx.globalAlpha = 1;
  }

  // Stories and members.
  y += 40;
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(input.stats, M, y + 32);
  y += 40;

  // Latest stories, when there's room.
  if (shown) {
    y += 64;
    ctx.globalAlpha = 0.8;
    ctx.font = `600 24px ${sans}`;
    ctx.letterSpacing = "4px";
    ctx.fillText(input.latestLabel.toLocaleUpperCase(input.lang), M, y + 24);
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;
    y += 40;
    for (const story of input.latest.slice(0, shown)) {
      ctx.globalAlpha = 0.3;
      ctx.fillRect(M, y + 10, textWidth, 2);
      ctx.globalAlpha = 1;
      ctx.font = `600 40px ${serif}`;
      ctx.fillText(wrapLines(story.title, textWidth, (t) => ctx.measureText(t).width, 1)[0] ?? "", M, y + 66);
      ctx.globalAlpha = 0.8;
      ctx.font = `400 28px ${sans}`;
      ctx.fillText(wrapLines(story.author, textWidth, (t) => ctx.measureText(t).width, 1)[0] ?? "", M, y + 104);
      ctx.globalAlpha = 1;
      y += itemHeight;
    }
  }

  // Invitation, above the bottom safe zone: the pill swaps the colors, so it reads on any accent.
  const ctaY = H - 400;
  ctx.font = `600 38px ${sans}`;
  const ctaText = `${input.cta}  →`;
  const ctaWidth = Math.min(textWidth, ctx.measureText(ctaText).width + 96);
  ctx.fillStyle = ink;
  roundedRect(ctx, M, ctaY, ctaWidth, 104, 52);
  ctx.fill();
  ctx.fillStyle = input.accentColor;
  ctx.fillText(ctaText, M + 48, ctaY + 66);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.85;
  ctx.font = `400 32px ${sans}`;
  ctx.fillText(readableCircleUrl(input.url), M, ctaY + 104 + 62);
  ctx.globalAlpha = 1;

  return toPng(canvas);
}
