"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { creditFromPhoto, type UnsplashPhoto } from "@/lib/domain/unsplash";
import { UnsplashCredit } from "./unsplash-credit";
import { UnsplashImage } from "./unsplash-image";
import { UnsplashPicker } from "./unsplash-picker";

/** Style-guide demo: pick a photo and see it as a credited figure. */
export function UnsplashDemo() {
  const t = useTranslations("Design");
  const [photo, setPhoto] = useState<UnsplashPhoto | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <UnsplashPicker onSelect={setPhoto} />
      </div>
      {photo ? (
        <figure className="max-w-xl" data-testid="unsplash-selected">
          <div
            className="relative overflow-hidden rounded-xl"
            style={{ aspectRatio: `${photo.width} / ${photo.height}`, backgroundColor: photo.color ?? "var(--muted)" }}
          >
            <UnsplashImage
              rawUrl={photo.rawUrl}
              alt={photo.alt}
              fill
              sizes="(min-width: 640px) 576px, 100vw"
              className="object-cover"
            />
          </div>
          <figcaption className="mt-2">
            <UnsplashCredit credit={creditFromPhoto(photo)} />
          </figcaption>
        </figure>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noPhotoSelected")}</p>
      )}
    </div>
  );
}
