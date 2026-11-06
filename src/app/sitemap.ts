import type { MetadataRoute } from "next";
import { sitemapData } from "@/lib/data/sitemap";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { LOCALES } from "@/lib/domain/locale";
import { publicEnv } from "@/lib/env";

/** Every public page worth finding: the localized pages (with their language versions) and share URLs. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const data = await sitemapData();

  // Each language version gets its own entry, listing the others (Google's hreflang-in-sitemap form).
  const localized = (path: string, lastModified?: Date): MetadataRoute.Sitemap => {
    const languages = Object.fromEntries(LOCALES.map((locale) => [locale, `${site}/${locale}${path}`]));
    return LOCALES.map((locale) => ({ url: `${site}/${locale}${path}`, lastModified, alternates: { languages } }));
  };
  const newest = data.stories[0]?.lastModified;

  return [
    ...localized("", newest),
    ...localized("/topics", newest),
    ...localized("/circles"),
    ...data.topics.flatMap((topic) => localized(`/topics/${topic.slug}`, topic.lastModified)),
    ...data.circles.flatMap((circle) => localized(`/circles/${circle.slug}`, circle.lastModified)),
    ...data.profiles.map((profile) => ({ url: `${site}${profilePath(profile.username)}`, lastModified: profile.lastModified })),
    ...data.stories.map((story) => ({ url: `${site}${storyPath(story.username, story.slug)}`, lastModified: story.lastModified })),
  ];
}
