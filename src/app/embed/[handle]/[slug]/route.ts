import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { getStory } from "@/lib/data/stories";
import { isAvatarUrl } from "@/lib/domain/avatars";
import { embedCsp, embedHtml, parseEmbedTheme } from "@/lib/domain/embed";
import { storyPath } from "@/lib/domain/handle-routes";
import { imageCreditSchema, isUnsplashImageUrl, UNSPLASH_HOME_URL, unsplashImageUrl, withUnsplashUtm } from "@/lib/domain/unsplash";
import { publicEnv } from "@/lib/env";
import { isAllowedStoryImage } from "@/lib/story-images";

/** "Read on Fogata": a framable card for a story (see src/lib/domain/embed.ts). */
export async function GET(request: NextRequest, { params }: RouteContext<"/embed/[handle]/[slug]">) {
  const { handle, slug } = await params;
  const supabase = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": embedCsp(["https://images.unsplash.com", supabase]),
    "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
  };
  const story = await getStory(handle, slug);
  if (!story || story.moderation === "removed") return new Response("Not found", { status: 404, headers: { ...headers, "Content-Type": "text/plain" } });

  const [t, common] = await Promise.all([
    getTranslations({ locale: story.language, namespace: "Embed" }),
    getTranslations({ locale: story.language, namespace: "Common" }),
  ]);
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const author = story.authorDisplayName || story.authorUsername;
  // The cover (credited when it's from Unsplash), else an uploaded first picture.
  const credit = imageCreditSchema.safeParse(story.coverCredit);
  let image = null;
  if (story.coverUrl && isAllowedStoryImage(story.coverUrl)) {
    const unsplash = isUnsplashImageUrl(story.coverUrl);
    if (!unsplash || credit.success) {
      image = {
        url: unsplash ? unsplashImageUrl(story.coverUrl, { width: 320 }) : story.coverUrl,
        alt: story.coverAlt || story.title,
        credit: unsplash && credit.success ? { label: credit.data.authorName, authorUrl: withUnsplashUtm(credit.data.authorUrl), siteUrl: UNSPLASH_HOME_URL } : null,
      };
    }
  } else if (story.thumbnailUrl && isAllowedStoryImage(story.thumbnailUrl) && !isUnsplashImageUrl(story.thumbnailUrl)) {
    image = { url: story.thumbnailUrl, alt: story.title, credit: null };
  }

  const html = embedHtml({
    lang: story.language,
    title: story.title,
    description: story.subtitle || story.excerpt,
    author,
    avatarUrl: isAvatarUrl(story.authorAvatarUrl, publicEnv.NEXT_PUBLIC_SUPABASE_URL) ? story.authorAvatarUrl : null,
    meta: common("minRead", { minutes: story.readingTime }),
    url: `${site}${storyPath(story.authorUsername, story.slug)}`,
    cta: t("cta"),
    accent: story.accentColor,
    image,
    warning: story.moderation === "nsfw" ? t("warning") : null,
    theme: parseEmbedTheme(request.nextUrl.searchParams.get("theme")),
  });
  return new Response(html, { headers });
}
