import { z } from "zod";

/**
 * Profile photo rules shared by the uploader, the server action and every place
 * that shows an avatar. Photos live at avatars/<user id>/<uuid>.webp in our own
 * Supabase Storage bucket; nothing else is ever rendered as an avatar.
 */

/** Side of the stored square photo, in pixels: sharp on high-density screens at the largest (128px) size. */
export const AVATAR_SIZE = 512;
/** Largest photo accepted before cropping (the browser shrinks it anyway). */
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024;
// iPhones convert HEIC photos to JPEG when a web page asks for an image, so HEIC isn't listed.
export const AVATAR_SOURCE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

const FILE = /^[0-9a-f-]{36}\.webp$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function avatarPrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/avatars/`;
}

/** The storage path (`<user id>/<file>`) of an avatar URL from our bucket, or null. */
export function avatarPath(url: string, supabaseUrl: string): string | null {
  const prefix = avatarPrefix(supabaseUrl);
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length);
  const [owner, file, extra] = rest.split("/");
  if (!owner || !file || extra !== undefined || !UUID.test(owner) || !FILE.test(file)) return null;
  return `${owner}/${file}`;
}

/** True only for a photo in this user's own folder (what a user may save as their avatar). */
export function isOwnAvatarUrl(url: string, supabaseUrl: string, userId: string): boolean {
  return avatarPath(url, supabaseUrl)?.startsWith(`${userId}/`) ?? false;
}

/** True for any photo in our avatars bucket (what may be rendered). */
export function isAvatarUrl(url: string | null | undefined, supabaseUrl: string): url is string {
  return typeof url === "string" && avatarPath(url, supabaseUrl) !== null;
}

/** The centered square to cut from a photo before scaling it down. */
export function centerSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

/** One or two letters for the fallback avatar ("Dana Whitfield" → "DW", "lucia" → "LU"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? `${[...parts[0]!][0] ?? ""}${[...parts.at(-1)!][0] ?? ""}` : [...name.trim()].slice(0, 2).join("");
  return letters.toLocaleUpperCase() || "?";
}

export const avatarUpdateSchema = z.object({
  avatarUrl: z.string().max(500).nullable(),
});
export type AvatarUpdateResult = { ok: true } | { ok: false; error: "unauthorized" | "invalid" };
