import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";
import { isLocale } from "@/lib/domain/locale";
import { OG_CACHE_CONTROL, OG_SIZE } from "@/lib/domain/og";
import { flameDataUrl, ogFonts } from "@/lib/og/assets";
import { SiteCard } from "@/lib/og/cards";

/** Share preview for Fogata itself (every page that doesn't have its own). */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("locale");
  const locale = isLocale(requested) ? requested : "en";
  const [t, flame, fonts] = await Promise.all([getTranslations({ locale, namespace: "Metadata" }), flameDataUrl(), ogFonts()]);
  return new ImageResponse(<SiteCard flame={flame} tagline={t("description")} />, {
    ...OG_SIZE,
    fonts,
    headers: { "Cache-Control": OG_CACHE_CONTROL },
  });
}
