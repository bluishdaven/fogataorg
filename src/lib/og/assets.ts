import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { OG_SIZE } from "@/lib/domain/og";

type OgFont = { name: string; data: Buffer; weight: 400 | 600; style: "normal" };

const FONT_FILES: [string, 400 | 600, string][] = [
  ["Inter", 400, "inter-latin-400-normal.woff"],
  ["Inter", 400, "inter-latin-ext-400-normal.woff"],
  ["Inter", 600, "inter-latin-600-normal.woff"],
  ["Inter", 600, "inter-latin-ext-600-normal.woff"],
  ["Source Serif", 600, "source-serif-4-latin-600-normal.woff"],
  ["Source Serif", 600, "source-serif-4-latin-ext-600-normal.woff"],
];

let fonts: Promise<OgFont[]> | null = null;

/** The site's own fonts (OFL, in src/assets/fonts), read once per server instance. */
export function ogFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    FONT_FILES.map(async ([name, weight, file]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "src/assets/fonts", file)),
    })),
  );
  return fonts;
}

let flame: Promise<string> | null = null;

/** The Fogata flame as a data URL. */
export function flameDataUrl(): Promise<string> {
  flame ??= readFile(join(process.cwd(), "public/brand/fogata-flame.svg")).then(
    (svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`,
  );
  return flame;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 8 * 1024 * 1024) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * A profile photo as a square PNG data URL. Photos are stored as WebP, which the preview renderer
 * can't draw. Callers must pass only URLs from our avatars bucket.
 */
export async function avatarPngDataUrl(url: string, size: number): Promise<string | null> {
  const source = await fetchImage(url);
  if (!source) return null;
  try {
    const png = await sharp(source).resize(size, size, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * A story picture as a 1200×630 JPEG (WebP isn't accepted by every link-preview fetcher). Callers
 * must pass only URLs from our story-images bucket; Unsplash pictures are hotlinked instead.
 */
export async function storyImageJpeg(url: string): Promise<Buffer | null> {
  const source = await fetchImage(url);
  if (!source) return null;
  try {
    return await sharp(source)
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}
