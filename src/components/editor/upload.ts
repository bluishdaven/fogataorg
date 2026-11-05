import { scaledSize } from "@/lib/domain/images";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Image uploads for stories. Photos are resized to at most 2400px and
 * re-encoded as WebP in the browser before upload, which keeps pages fast and
 * strips camera metadata (GPS location included). GIFs are kept as-is so they
 * stay animated. Files land in story-images/<user id>/, the only folder the
 * writer may write to (enforced by storage policies).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const ACCEPTED_IMAGE_TYPES = ACCEPTED.join(",");

export class UploadError extends Error {
  constructor(readonly reason: "type" | "size" | "failed") {
    super(reason);
    this.name = "UploadError";
  }
}

export type UploadedImage = { url: string; width: number; height: number };

async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number; type: string }> {
  if (!ACCEPTED.includes(file.type)) throw new UploadError("type");
  const bitmap = await createImageBitmap(file);
  const original = { width: bitmap.width, height: bitmap.height };

  if (file.type === "image/gif") {
    bitmap.close();
    if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("size");
    return { blob: file, ...original, type: file.type };
  }

  const size = scaledSize(original.width, original.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("failed");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new UploadError("failed");
  if (blob.size > MAX_UPLOAD_BYTES) throw new UploadError("size");
  return { blob, ...size, type: blob.type || "image/webp" };
}

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

export async function uploadStoryImage(file: File, userId: string): Promise<UploadedImage> {
  const { blob, width, height, type } = await prepare(file);
  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[type] ?? "webp"}`;
  const bucket = supabaseBrowser().storage.from("story-images");
  const { error } = await bucket.upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw new UploadError("failed");
  return { url: bucket.getPublicUrl(path).data.publicUrl, width, height };
}
