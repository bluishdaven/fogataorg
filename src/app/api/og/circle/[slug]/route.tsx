import { ImageResponse } from "next/og";
import { getCircle } from "@/lib/data/circles";
import { readableTextOn } from "@/lib/domain/circles";
import { clampText, OG_CACHE_CONTROL, OG_SIZE } from "@/lib/domain/og";
import { storyImagePrefix } from "@/lib/domain/stories";
import { publicEnv } from "@/lib/env";
import { flameDataUrl, ogFonts, storyImageJpeg } from "@/lib/og/assets";
import { CircleCard } from "@/lib/og/cards";

/**
 * Share preview for a circle: its uploaded header as a JPEG, or (no header) a card with its name on
 * its accent color. Unsplash headers are hotlinked from the page metadata, never proxied.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/og/circle/[slug]">) {
  const { slug } = await params;
  const circle = await getCircle(slug);
  if (!circle) return new Response("Not found", { status: 404 });

  if (circle.header?.url.startsWith(storyImagePrefix(publicEnv.NEXT_PUBLIC_SUPABASE_URL))) {
    const jpeg = await storyImageJpeg(circle.header.url);
    if (jpeg) {
      return new Response(new Uint8Array(jpeg), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": OG_CACHE_CONTROL },
      });
    }
  }

  const [flame, fonts] = await Promise.all([flameDataUrl(), ogFonts()]);
  return new ImageResponse(
    (
      <CircleCard
        flame={flame}
        name={clampText(circle.name, 60)}
        description={clampText(circle.description, 180)}
        accent={circle.accentColor}
        accentText={readableTextOn(circle.accentColor)}
      />
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": OG_CACHE_CONTROL } },
  );
}
