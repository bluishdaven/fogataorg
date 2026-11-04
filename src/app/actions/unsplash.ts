"use server";

import { getViewer } from "@/lib/auth";
import { unsplashPhotoIdSchema } from "@/lib/domain/unsplash";
import { triggerUnsplashDownload, unsplashAccessKey } from "@/lib/unsplash/client";

/**
 * Called when a writer picks an Unsplash photo. Unsplash counts this as a
 * download and credits the photographer. Only the photo id comes from the
 * client; the endpoint is built here.
 */
export async function trackUnsplashSelection(photoId: string): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  const id = unsplashPhotoIdSchema.safeParse(photoId);
  if (!viewer || !id.success || !unsplashAccessKey()) return { ok: false };
  try {
    await triggerUnsplashDownload(id.data);
    return { ok: true };
  } catch (error) {
    console.error("[unsplash] download tracking failed", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}
