import "server-only";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { profiles, prompts, stories, storyTopics, topics } from "@/lib/db/schema";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { readInfluences } from "@/lib/domain/profile";
import { isAllowedStoryImage } from "@/lib/story-images";
import { donorActiveSql, foundingNumberSql, publishedCountSql } from "./badge-sql";
import { moderationReasonSql, moderationStatusSql, notModerated, notRemoved } from "./moderation-sql";

/**
 * Public story reads. They run as `anon`, so RLS guarantees drafts never leak
 * even if a filter here is wrong, and they're safe to cache across readers.
 * Tags: "stories" for any listing, `story:<handle>/<slug>` and
 * `profile:<handle>` for single pages (revalidated on publish in Phase 1).
 */

export const cardColumns = {
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
  authorId: profiles.id,
  authorUsername: profiles.username,
  authorDisplayName: profiles.displayName,
  authorAvatarUrl: profiles.avatarUrl,
  authorPronouns: profiles.pronouns,
  authorPublishedCount: publishedCountSql(),
  authorDonorActive: donorActiveSql(),
  authorFoundingNumber: foundingNumberSql(),
  moderation: moderationStatusSql,
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
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorPronouns: string;
  authorPublishedCount: number;
  authorDonorActive: boolean;
  authorFoundingNumber: number | null;
  moderation: "nsfw" | "removed" | null;
};

export function toCard(row: CardRow) {
  return {
    title: row.title,
    subtitle: row.subtitle,
    slug: row.slug,
    language: row.language,
    readingTime: row.readingTime,
    publishedAt: row.publishedAt,
    excerpt: excerpt(row.contentText),
    nsfw: row.moderation === "nsfw",
    authorId: row.authorId,
    // NSFW stories never show a picture in lists.
    thumbnail:
      row.moderation !== "nsfw" && row.thumbnailUrl && isAllowedStoryImage(row.thumbnailUrl)
        ? { url: row.thumbnailUrl, alt: row.thumbnailAlt }
        : null,
    author: {
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarUrl: row.authorAvatarUrl,
      pronouns: row.authorPronouns,
      badges: badgeData({ publishedCount: row.authorPublishedCount, donorActive: row.authorDonorActive, foundingNumber: row.authorFoundingNumber }),
    },
  };
}

const listed = and(
  eq(stories.status, "published"),
  isNull(stories.deletedAt),
  lte(stories.publishedAt, sql`now()`),
  notRemoved,
);
/** Feeds (home, topics) also leave out NSFW stories. */
export const inFeeds = and(listed, notModerated);

/** The newest stories, optionally only in some languages (a signed-in reader's reading languages). */
export async function getLatestStories(limit = 20, languages?: ("en" | "es")[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag("stories");

  const rows = await asAnon((tx) =>
    tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(languages?.length ? and(inFeeds, inArray(stories.language, languages)) : inFeeds)
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
        accentColor: stories.accentColor,
        thumbnailUrl: stories.thumbnailUrl,
        seoTitle: stories.seoTitle,
        seoDescription: stories.seoDescription,
        authorId: profiles.id,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
        authorAvatarUrl: profiles.avatarUrl,
        authorPublishedCount: publishedCountSql(),
        authorDonorActive: donorActiveSql(),
        authorFoundingNumber: foundingNumberSql(),
        authorBio: profiles.bio,
        authorPronouns: profiles.pronouns,
        wordCount: sql<number>`"stories"."word_count"`,
        seriesId: stories.seriesId,
        promptWeek: prompts.weekOf,
        promptTextEn: prompts.textEn,
        promptTextEs: prompts.textEs,
        promptFeatured: sql<boolean>`exists (select 1 from public.prompt_features pf where pf.story_id = "stories"."id")`,
        authorNowFocus: profiles.nowFocus,
        authorNowText: profiles.nowText,
        moderation: moderationStatusSql,
        moderationReason: moderationReasonSql,
      })
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .leftJoin(prompts, eq(prompts.id, stories.promptId))
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
        donorActive: donorActiveSql(),
        foundingNumber: foundingNumberSql(),
        bio: profiles.bio,
        links: profiles.links,
        pronouns: profiles.pronouns,
        nowFocus: profiles.nowFocus,
        nowText: profiles.nowText,
        influences: profiles.influences,
        locale: profiles.locale,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = lower(${handle})`)
      .limit(1);
    if (!profile) return null;

    // Totals over every story the profile lists (the list itself stops at 50).
    const [totals] = await tx
      .select({
        stories: sql<number>`count(*)::int`,
        words: sql<number>`coalesce(sum("stories"."word_count"), 0)::int`,
      })
      .from(stories)
      .where(and(listed, eq(stories.authorId, profile.id)));

    const rows = await tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(listed, eq(stories.authorId, profile.id)))
      .orderBy(desc(stories.publishedAt))
      .limit(50);

    return {
      ...profile,
      influences: readInfluences(profile.influences),
      storyCount: totals?.stories ?? 0,
      wordCount: totals?.words ?? 0,
      stories: rows.map(toCard),
    };
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
      .where(and(inFeeds, eq(storyTopics.topicId, topic.id)))
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
      .leftJoin(stories, and(eq(stories.id, storyTopics.storyId), inFeeds))
      .groupBy(topics.id)
      .orderBy(topics.slug),
  );
}
