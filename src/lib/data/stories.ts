import "server-only";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { profiles, stories, storyTopics, topics } from "@/lib/db/schema";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { isAllowedStoryImage } from "@/lib/story-images";
import { publishedCountSql } from "./badge-sql";

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
  // Listings only need an excerpt, not the whole story.
  contentText: sql<string>`left(${stories.contentText}, 400)`,
  thumbnailUrl: stories.thumbnailUrl,
  thumbnailAlt: stories.thumbnailAlt,
  authorUsername: profiles.username,
  authorDisplayName: profiles.displayName,
  authorAvatarUrl: profiles.avatarUrl,
  authorPublishedCount: publishedCountSql(),
  authorDonorSince: profiles.donorSince,
};

type CardRow = {
  title: string;
  subtitle: string;
  slug: string;
  language: "en" | "es";
  readingTime: number;
  publishedAt: Date | null;
  contentText: string;
  thumbnailUrl: string | null;
  thumbnailAlt: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorPublishedCount: number;
  authorDonorSince: Date | null;
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
    thumbnail:
      row.thumbnailUrl && isAllowedStoryImage(row.thumbnailUrl) ? { url: row.thumbnailUrl, alt: row.thumbnailAlt } : null,
    author: {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
      badges: badgeData({ publishedCount: row.authorPublishedCount, donorSince: row.authorDonorSince }),
    },
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
  cacheTag("stories", `story:${handle.toLowerCase()}/${slug}`);

  const story = await asAnon(async (tx) => {
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
        coverUrl: stories.coverUrl,
        coverAlt: stories.coverAlt,
        coverCredit: stories.coverCredit,
        thumbnailUrl: stories.thumbnailUrl,
        seoTitle: stories.seoTitle,
        seoDescription: stories.seoDescription,
        authorId: profiles.id,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
        authorAvatarUrl: profiles.avatarUrl,
        authorPublishedCount: publishedCountSql(),
        authorDonorSince: profiles.donorSince,
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

    const [circle] = await tx.execute<{ slug: string; name: string; accent_color: string }>(sql`
      select c.slug, c.name, c.accent_color
      from public.circle_submissions cs
      join public.circles c on c.id = cs.circle_id
      where cs.story_id = ${row.id} and cs.status = 'accepted'
      limit 1
    `);

    return {
      ...row,
      excerpt: excerpt(row.contentText, 160),
      topics: storyTopicRows,
      circle: circle ? { slug: circle.slug, name: circle.name, accentColor: circle.accent_color } : null,
    };
  });

  // A miss may be a scheduled story that goes live soon, so don't remember it for long.
  if (story) cacheLife("hours");
  else cacheLife("minutes");
  return story;
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
        avatarUrl: profiles.avatarUrl,
        publishedCount: publishedCountSql(),
        donorSince: profiles.donorSince,
        bio: profiles.bio,
        links: profiles.links,
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

export async function getTopicWithStories(slug: string) {
  "use cache";
  cacheTag("stories", "topics", `topic:${slug}`);

  const result = await asAnon(async (tx) => {
    const [topic] = await tx
      .select({ id: topics.id, slug: topics.slug, nameEn: topics.nameEn, nameEs: topics.nameEs })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);
    if (!topic) return null;

    const rows = await tx
      .select(cardColumns)
      .from(storyTopics)
      .innerJoin(stories, eq(stories.id, storyTopics.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(listed, eq(storyTopics.topicId, topic.id)))
      .orderBy(desc(stories.publishedAt))
      .limit(50);

    return { ...topic, stories: rows.map(toCard) };
  });

  if (result) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

export async function listTopicsWithCounts() {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", "topics");

  return asAnon((tx) =>
    tx
      .select({
        slug: topics.slug,
        nameEn: topics.nameEn,
        nameEs: topics.nameEs,
        count: sql<number>`count(${stories.id})::int`,
      })
      .from(topics)
      .leftJoin(storyTopics, eq(storyTopics.topicId, topics.id))
      .leftJoin(stories, and(eq(stories.id, storyTopics.storyId), listed))
      .groupBy(topics.id)
      .orderBy(topics.slug),
  );
}
