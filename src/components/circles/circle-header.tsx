import type { ReactNode } from "react";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import { readableTextOn } from "@/lib/domain/circles";
import type { ImageCredit } from "@/lib/domain/unsplash";
import { isUnsplashImageUrl } from "@/lib/domain/unsplash";

/**
 * A circle's banner: optional header image above a band in the circle's accent
 * color. Text color is picked for contrast, so any accent stays readable.
 */
export function CircleHeader({
  name,
  description,
  accentColor,
  header,
  children,
}: {
  name: string;
  description: string;
  accentColor: string;
  header: { url: string; alt: string; credit: ImageCredit | null } | null;
  children?: ReactNode;
}) {
  const text = readableTextOn(accentColor);
  return (
    <header className="overflow-hidden rounded-2xl border border-border">
      {header ? (
        <div className="relative aspect-[4/1] bg-muted">
          {isUnsplashImageUrl(header.url) ? (
            <UnsplashImage rawUrl={header.url} alt={header.alt} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          ) : (
            // Uploaded headers are resized and compressed on upload.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={header.url} alt={header.alt} className="absolute inset-0 size-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 px-6 py-6 sm:px-8" style={{ backgroundColor: accentColor, color: text }} data-testid="circle-band">
        <h1 className="font-serif text-3xl font-semibold text-balance sm:text-4xl">{name}</h1>
        {description ? <p className="max-w-2xl text-pretty opacity-90">{description}</p> : null}
        {children}
      </div>
      {header?.credit ? (
        <div className="bg-card px-6 py-1.5">
          <UnsplashCredit credit={header.credit} />
        </div>
      ) : null}
    </header>
  );
}
