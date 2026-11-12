import "server-only";
import { getTranslations } from "next-intl/server";
import { getCircle } from "@/lib/data/circles";
import { getProfileWithStories, getTopicWithStories } from "@/lib/data/stories";
import { circleShareUrl } from "@/lib/domain/circle-card";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { isLocale, type Locale } from "@/lib/domain/locale";
import { rssFeed, rssPaths, type FeedItem } from "@/lib/domain/rss";
import { publicEnv } from "@/lib/env";

/** Builds the feeds from the same cached data the pages use. NSFW stories are left out. */

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
const absolute = (path: string) => `${site()}${path}`;
const brandImage = () => absolute("/brand/fogata-flame-1024.png");

type CardLike = {
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  publishedAt: Date | null;
  nsfw?: boolean;
  author: { username: string; displayName: string };
};

function items(stories: CardLike[]): FeedItem[] {
  return stories
    .filter((story) => !story.nsfw)
    .slice(0, 30)
    .map((story) => ({
      title: story.title,
      link: absolute(storyPath(story.author.username, story.slug)),
      description: story.subtitle || story.excerpt,
      author: story.author.displayName || story.author.username,
      publishedAt: story.publishedAt,
    }));
}

export function feedLocale(value: string | null): Locale {
  return value && isLocale(value) ? value : "en";
}

export async function writerFeed(handle: string): Promise<string | null> {
  const profile = await getProfileWithStories(handle);
  if (!profile) return null;
  const locale = feedLocale(profile.locale);
  const t = await getTranslations({ locale, namespace: "Rss" });
  const name = profile.displayName || profile.username;
  return rssFeed({
    title: t("writerTitle", { name }),
    link: absolute(profilePath(profile.username)),
    selfUrl: absolute(rssPaths.writer(profile.username)),
    description: profile.bio || t("writerDescription", { name }),
    language: locale,
    imageUrl: brandImage(),
    items: items(profile.stories),
  });
}

export async function circleFeed(slug: string, locale: Locale): Promise<string | null> {
  const circle = await getCircle(slug);
  if (!circle) return null;
  const t = await getTranslations({ locale, namespace: "Rss" });
  return rssFeed({
    title: t("circleTitle", { name: circle.name }),
    link: circleShareUrl(site(), circle.slug),
    selfUrl: absolute(rssPaths.circle(circle.slug, locale)),
    description: circle.description || t("circleDescription", { name: circle.name }),
    language: locale,
    imageUrl: brandImage(),
    items: items(circle.stories),
  });
}

export async function topicFeed(slug: string, locale: Locale): Promise<string | null> {
  const topic = await getTopicWithStories(slug);
  if (!topic) return null;
  const t = await getTranslations({ locale, namespace: "Rss" });
  const name = locale === "es" ? topic.nameEs : topic.nameEn;
  return rssFeed({
    title: t("topicTitle", { name }),
    link: absolute(`/${locale}/topics/${topic.slug}`),
    selfUrl: absolute(rssPaths.topic(topic.slug, locale)),
    description: t("topicDescription", { name }),
    language: locale,
    imageUrl: brandImage(),
    items: items(topic.stories),
  });
}
