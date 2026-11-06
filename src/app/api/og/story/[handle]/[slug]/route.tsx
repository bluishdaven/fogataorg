import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";
import { getStory } from "@/lib/data/stories";
import { clampText, OG_CACHE_CONTROL, OG_SIZE } from "@/lib/domain/og";
import { storyImagePrefix } from "@/lib/domain/stories";
import { publicEnv } from "@/lib/env";
import { flameDataUrl, ogFonts, storyImageJpeg } from "@/lib/og/assets";
import { StoryCard } from "@/lib/og/cards";

/**
 * Share preview for a story: its uploaded picture as a JPEG, or (no picture, an Unsplash picture
 * reached here by mistake, or NSFW) a card with the title and writer. Unsplash pictures are
 * hotlinked from the page metadata, never proxied.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/og/story/[handle]/[slug]">) {
  const { handle, slug } = await params;
  const story = await getStory(handle, slug);
  if (!story || story.moderation === "removed") return new Response("Not found", { status: 404 });

  const uploaded =
    story.moderation === "nsfw"
      ? null
      : ([story.coverUrl, story.thumbnailUrl].find(
          (url): url is string => !!url && url.startsWith(storyImagePrefix(publicEnv.NEXT_PUBLIC_SUPABASE_URL)),
        ) ?? null);
  if (uploaded) {
    const jpeg = await storyImageJpeg(uploaded);
    if (jpeg) {
      return new Response(new Uint8Array(jpeg), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": OG_CACHE_CONTROL },
      });
    }
  }

  // Card text follows the story's language, like the Stories image.
  const [t, flame, fonts] = await Promise.all([
    getTranslations({ locale: story.language, namespace: "Common" }),
    flameDataUrl(),
    ogFonts(),
  ]);
  return new ImageResponse(
    (
      <StoryCard
        flame={flame}
        title={clampText(story.title, 120)}
        subtitle={clampText(story.subtitle, 140)}
        author={story.authorDisplayName || story.authorUsername}
        meta={t("minRead", { minutes: story.readingTime })}
      />
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": OG_CACHE_CONTROL } },
  );
}
