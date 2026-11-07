import { storiesThatFit, readableCircleUrl } from "@/lib/domain/circle-card";
import { readableTextOn } from "@/lib/domain/circles";
import { fitTitle, STORY_IMAGE, wrapLines } from "@/lib/domain/story-card";
import { FLAME_INNER, FLAME_OUTER, fontFamily, loadImage, roundedRect } from "@/components/social/story-image";

/**
 * Draws a circle's "Stories" share image in the browser (1080×1920, Instagram safe zones): the
 * circle's accent color with soft rings, its header picture when it's one we host, the name, what
 * it's about, how many stories and members it has, its latest stories when there's room, and an
 * invitation to read. Text is white or black, whichever reads on the accent (readableTextOn).
 */

export type CircleImageInput = {
  name: string;
  description: string;
  accentColor: string;
  /** Only an uploaded header in our bucket (CORS-enabled); Unsplash photos are never baked in. */
  headerUrl: string | null;
  /** Copy in the sharer's language. */
  eyebrow: string;
  stats: string;
  latestLabel: string;
  latest: { title: string; author: string }[];
  cta: string;
  url: string;
  lang: string;
};

export async function renderCircleImage(input: CircleImageInput): Promise<Blob> {
  const { width: W, height: H, margin: M } = STORY_IMAGE;
  const serif = fontFamily("--font-source-serif", "Georgia, 'Times New Roman', serif");
  const sans = fontFamily("--font-inter", "system-ui, -apple-system, 'Segoe UI', sans-serif");
  const ink = readableTextOn(input.accentColor);

  const [header] = await Promise.all([
    input.headerUrl ? loadImage(input.headerUrl) : Promise.resolve(null),
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

  // The circle's color, with faint rings spreading from the lower corner, like people around a fire.
  ctx.fillStyle = input.accentColor;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  for (let ring = 1; ring <= 7; ring += 1) {
    ctx.globalAlpha = 0.09 - ring * 0.008;
    ctx.beginPath();
    ctx.arc(W - 40, H - 260, ring * 210, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Brand, inside the top safe zone: the flame cut from the accent so it shows on any color.
  const flameScale = 1.7;
  ctx.save();
  ctx.translate(M, 196);
  ctx.scale(flameScale, flameScale);
  ctx.fillStyle = ink;
  ctx.fill(new Path2D(FLAME_OUTER));
  ctx.fillStyle = input.accentColor;
  ctx.fill(new Path2D(FLAME_INNER));
  ctx.restore();
  ctx.fillStyle = ink;
  ctx.font = `600 48px ${serif}`;
  ctx.fillText("Fogata", M + 32 * flameScale + 18, 196 + 40 * flameScale - 14);

  const textWidth = W - M * 2;
  const top = 360;
  const bottom = H - 470;

  // Measure everything first, so the block can sit in the middle of the space it has.
  const headerHeight = header ? 444 : 0;
  const headerGap = header ? 72 : 0;
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

  // Header picture, cover-cropped into a rounded frame.
  if (header) {
    const frameRatio = textWidth / headerHeight;
    const imageRatio = header.naturalWidth / header.naturalHeight;
    const sw = imageRatio > frameRatio ? header.naturalHeight * frameRatio : header.naturalWidth;
    const sh = imageRatio > frameRatio ? header.naturalHeight : header.naturalWidth / frameRatio;
    ctx.save();
    roundedRect(ctx, M, y, textWidth, headerHeight, 32);
    ctx.clip();
    ctx.drawImage(header, (header.naturalWidth - sw) / 2, (header.naturalHeight - sh) / 2, sw, sh, M, y, textWidth, headerHeight);
    ctx.restore();
    y += headerHeight + headerGap;
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

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))), "image/png"),
  );
}
