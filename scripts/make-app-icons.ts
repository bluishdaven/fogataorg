/**
 * Draws the installable app's icons from the flame (src/app/icon.svg) into public/app/.
 * Rerun after changing the flame: `npx tsx scripts/make-app-icons.ts`.
 *
 * - icon-192.png / icon-512.png: the flame on cream, like apple-icon.png ("any" purpose).
 * - icon-maskable-512.png: smaller flame, so launchers can crop it to any shape (the safe zone is
 *   the middle 80% circle).
 * - badge-96.png: white flame silhouette on transparent, for Android's status bar.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const CREAM = "#faf6ee";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/app");

async function flame(size: number, svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 1200 }).resize(size, size, { fit: "contain", background: "#0000" }).png().toBuffer();
}

async function onCream(size: number, flameShare: number, svg: string, file: string) {
  const inner = Math.round(size * flameShare);
  const offset = Math.round((size - inner) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: await flame(inner, svg), left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));
}

async function main() {
  await mkdir(out, { recursive: true });
  const svg = await readFile(path.join(root, "src/app/icon.svg"), "utf8");
  // Same proportions as apple-icon.png.
  await onCream(192, 0.72, svg, "icon-192.png");
  await onCream(512, 0.72, svg, "icon-512.png");
  await onCream(512, 0.56, svg, "icon-maskable-512.png");
  // Both flame layers in white: the status bar only uses the alpha channel.
  const silhouette = svg.replaceAll(/fill="#[0-9a-f]{6}"/gi, 'fill="#ffffff"').replace(/<path d="M16\.5[^>]*\/>/, "");
  await sharp({ create: { width: 96, height: 96, channels: 4, background: "#0000" } })
    .composite([{ input: await flame(80, silhouette), left: 8, top: 8 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, "badge-96.png"));
  console.info("Icons written to public/app/");
}

void main();
