import "server-only";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { profiles, stories, storyTopics, topics } from "@/lib/db/schema";
import { excerpt } from "@/lib/domain/content";

/**
 * Public story reads. They run as `anon`, so RLS guarantees drafts never leak
 * even if a filter here is wrong, and they're safe to cache across readers.
 * Tags: "stories" for any listing, `story:<handle>/<slug>` and
 * `profile:<handle>` for single pages (revalidated on publish in Phase 1).
 */

const cardColumns = {
  title: stories.title,
  subtitle: stories.subtitle,
  slug: stories.slug,
  language: stories.language,
  readingTime: stories.readingTime,
  publishedAt: stories.publishedAt,
  contentText: stories.contentText,
  authorUsername: profiles.username,
  authorDisplayName: profiles.displayName,
};

type CardRow = {
  title: string;
  subtitle: string;
  slug: string;
  language: "en" | "es";
  readingTime: number;
  publishedAt: Date | null;
  contentText: string;
  authorUsername: string;
  authorDisplayName: string;
};

function toCard(row: CardRow) {
  return {
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    language: row.language,
    readingTime: row.readingTime,
    publishedAt: row.publishedAt,
    excerpt: excerpt(row.contentText),
    author: { username: row.authorUsername, displayName: row.authorDisplayName },
  };
}

const listed = and(
  eq(stories.status, "published"),
  isNull(stories.deletedAt),
  lte(stories.publishedAt, sql`now()`),
);

export async function getLatestStories(limit = 20) {
  "use cache";
  cacheLife("minutes");
  cacheTag("stories");

  const rows = await asAnon((tx) =>
    tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(listed)
      .orderBy(desc(stories.publishedAt))
      .limit(limit),
  );
  return rows.map(toCard);
}

export async function getStory(handle: string, slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", `story:${handle.toLowerCase()}/${slug}`);

  return asAnon(async (tx) => {
    const [row] = await tx
      .select({
        id: stories.id,
        title: stories.title,
        subtitle: stories.subtitle,
        slug: stories.slug,
        content: stories.content,
        language: stories.language,
        status: stories.status,
        readingTime: stories.readingTime,
        publishedAt: stories.publishedAt,
        canonicalUrl: stories.canonicalUrl,
        contentText: stories.contentText,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
        authorBio: profiles.bio,
      })
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      // RLS limits this to published/unlisted stories.
      .where(and(sql`lower(${profiles.username}) = lower(${handle})`, eq(stories.slug, slug)))
      .limit(1);
    if (!row) return null;

    const storyTopicRows = await tx
      .select({ slug: topics.slug, nameEn: topics.nameEn, nameEs: topics.nameEs })
      .from(storyTopics)
      .innerJoin(topics, eq(topics.id, storyTopics.topicId))
      .where(eq(storyTopics.storyId, row.id))
      .orderBy(topics.slug);

    return { ...row, excerpt: excerpt(row.contentText, 160), topics: storyTopicRows };
  });
}

export async function getProfileWithStories(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", `profile:${handle.toLowerCase()}`);

  return asAnon(async (tx) => {
    const [profile] = await tx
      .select({
        id: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        bio: profiles.bio,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = lower(${handle})`)
      .limit(1);
    if (!profile) return null;

    const rows = await tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(listed, eq(stories.authorId, profile.id)))
      .orderBy(desc(stories.publishedAt))
      .limit(50);

    return { ...profile, stories: rows.map(toCard) };
  });
}
