"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";
import { unsplashImageUrl } from "@/lib/domain/unsplash";

/**
 * Responsive Unsplash image. The loader asks Unsplash's own CDN for each size
 * (hotlinking, as their guidelines require) instead of re-hosting the file.
 */
const unsplashLoader: ImageLoader = ({ src, width, quality }) => unsplashImageUrl(src, { width, quality });

export function UnsplashImage({
  rawUrl,
  alt,
  ...props
}: Omit<ImageProps, "src" | "loader" | "alt"> & { rawUrl: string; alt: string }) {
  return <Image {...props} loader={unsplashLoader} src={rawUrl} alt={alt} />;
}
