import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { isPublicAddress } from "@/lib/domain/import/network";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

class CopyError extends Error {}

/** Fetches a URL only if every address its host resolves to is public; follows redirects by hand so each hop is checked. */
async function guardedFetch(target: string, redirects = 0): Promise<Response> {
  const url = new URL(target);
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) throw new CopyError("scheme");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
  if (!addresses.length || !addresses.every(isPublicAddress)) throw new CopyError("address");
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "FogataImport/1.0 (+https://fogata.org)", accept: "image/*" },
  });
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    if (redirects >= MAX_REDIRECTS) throw new CopyError("redirects");
    return guardedFetch(new URL(location, url).toString(), redirects + 1);
  }
  return response;
}

async function readCapped(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) throw new CopyError("size");
  const reader = response.body?.getReader();
  if (!reader) throw new CopyError("body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    total += next.value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new CopyError("size");
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks);
}

/**
 * Downloads a picture from an imported post and re-encodes it the way browser uploads are: WebP,
 * at most 2400 px, no metadata (EXIF/GPS). Returns null when it can't be copied.
 */
export async function fetchImportImage(src: string): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const response = await guardedFetch(src);
    if (!response.ok || !(response.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const original = await readCapped(response);
    const { data, info } = await sharp(original, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}
