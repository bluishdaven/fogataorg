import { Lock } from "lucide-react";
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
  privateLabel,
  privateNote,
  children,
}: {
  name: string;
  description: string;
  accentColor: string;
  header: { url: string; alt: string; credit: ImageCredit | null } | null;
  /** Set (translated) for private circles. */
  privateLabel?: string | null;
  privateNote?: string | null;
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
        {privateLabel ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="circle-private">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-0.5 font-medium">
              <Lock className="size-3.5" aria-hidden />
              {privateLabel}
            </span>
            {privateNote ? <span>{privateNote}</span> : null}
          </p>
        ) : null}
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
