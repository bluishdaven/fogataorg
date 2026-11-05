import { UploadError } from "@/components/editor/upload";
import {
  AVATAR_SIZE,
  AVATAR_SOURCE_TYPES,
  MAX_AVATAR_SOURCE_BYTES,
  avatarPath,
  centerSquare,
} from "@/lib/domain/avatars";
import { publicEnv } from "@/lib/env";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Profile photos are cropped to a centered square, scaled to at most 512px and
 * re-encoded as WebP in the browser, which also strips camera metadata (GPS
 * included). They land in avatars/<user id>/, the only folder the user may write.
 */

export const ACCEPTED_AVATAR_TYPES = AVATAR_SOURCE_TYPES.join(",");

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (!AVATAR_SOURCE_TYPES.includes(file.type)) throw new UploadError("type");
  if (file.size > MAX_AVATAR_SOURCE_BYTES) throw new UploadError("size");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError("type");
  }
  const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("failed");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob || blob.type !== "image/webp") throw new UploadError("failed");

  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const bucket = supabaseBrowser().storage.from("avatars");
  const { error } = await bucket.upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new UploadError("failed");
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Best effort: deletes a photo we no longer use. Storage policies allow only the owner's folder. */
export async function deleteAvatarFile(url: string | null): Promise<void> {
  const path = url ? avatarPath(url, publicEnv.NEXT_PUBLIC_SUPABASE_URL) : null;
  if (!path) return;
  await supabaseBrowser().storage.from("avatars").remove([path]);
}
