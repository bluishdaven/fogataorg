/** Longest side of uploaded images, in pixels. */
export const MAX_IMAGE_DIMENSION = 2400;

/** Fits an image inside MAX_IMAGE_DIMENSION without upscaling. */
export function scaledSize(width: number, height: number, max = MAX_IMAGE_DIMENSION): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
