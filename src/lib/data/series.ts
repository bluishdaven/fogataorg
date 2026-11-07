import "server-only";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { profiles, series, stories } from "@/lib/db/schema";
import { badgeData } from "@/lib/domain/badges";
import { donorActiveSql, publishedCountSql } from "./badge-sql";
import { notRemoved } from "./moderation-sql";
import { cardColumns, toCard } from "./stories";

/** Parts readers can see: published (not unlisted), live, not removed. */
const listedPart = and(eq(stories.status, "published"), isNull(stories.deletedAt), lte(stories.publishedAt, sql`now()`), notRemoved);

/** A series and its parts in order, for the story page's "Part 2 of 5" box. */
export async function getStorySeries(seriesId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", `series:${seriesId}`);
  return asAnon(async (tx) => {
    const [row] = await tx.select({ id: series.id, title: series.title, slug: series.slug }).from(series).where(eq(series.id, seriesId)).limit(1);
    if (!row) return null;
    const parts = await tx
      .select({ slug: stories.slug, title: stories.title })
      .from(stories)
      .where(and(eq(stories.seriesId, seriesId), listedPart))
      .orderBy(asc(stories.seriesPosition), asc(stories.publishedAt));
    return { ...row, parts };
  });
}

/** The series page: the series, its writer, and its parts as story cards. */
export async function getSeriesPage(handle: string, slug: string) {
  "use cache";
  cacheTag("stories", `profile:${handle.toLowerCase()}`);
  const result = await asAnon(async (tx) => {
    const [row] = await tx
      .select({
        id: series.id,
        title: series.title,
        slug: series.slug,
        description: series.description,
        updatedAt: series.updatedAt,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
        authorAvatarUrl: profiles.avatarUrl,
        authorPronouns: profiles.pronouns,
        authorPublishedCount: publishedCountSql(),
        authorDonorActive: donorActiveSql(),
      })
      .from(series)
      .innerJoin(profiles, eq(profiles.id, series.authorId))
      .where(and(sql`lower(${profiles.username}) = lower(${handle})`, eq(series.slug, slug)))
      .limit(1);
    if (!row) return null;
    const parts = await tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(stories.seriesId, row.id), listedPart))
      .orderBy(asc(stories.seriesPosition), asc(stories.publishedAt));
    return {
      ...row,
      author: {
        username: row.authorUsername,
        displayName: row.authorDisplayName,
        avatarUrl: row.authorAvatarUrl,
        pronouns: row.authorPronouns,
        badges: badgeData({ publishedCount: row.authorPublishedCount, donorActive: row.authorDonorActive }),
      },
      parts: parts.map(toCard),
    };
  });
  if (result) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

/** A writer's series that have at least one part readers can see, for their profile. */
export async function listProfileSeries(handle: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", `profile:${handle.toLowerCase()}`);
  return asAnon((tx) =>
    tx
      .select({
        slug: series.slug,
        title: series.title,
        description: series.description,
        parts: sql<number>`(select count(*)::int from public.stories s where s.series_id = "series"."id" and s.status = 'published' and s.deleted_at is null and s.published_at <= now() and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id and sm.status = 'removed'))`,
      })
      .from(series)
      .innerJoin(profiles, eq(profiles.id, series.authorId))
      .where(sql`lower(${profiles.username}) = lower(${handle})`)
      .orderBy(desc(series.updatedAt)),
  ).then((rows) => rows.filter((row) => row.parts > 0));
}

/** Everything /me/series needs: the writer's series with every part, and stories not in one. */
export async function listMySeries(viewer: Viewer) {
  return withRls(viewer.claims, async (tx) => {
    const mine = await tx
      .select({ id: series.id, title: series.title, slug: series.slug, description: series.description })
      .from(series)
      .where(eq(series.authorId, viewer.id))
      .orderBy(desc(series.updatedAt));
    const storyRows = await tx
      .select({ id: stories.id, title: stories.title, slug: stories.slug, status: stories.status, seriesId: stories.seriesId, seriesPosition: stories.seriesPosition })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .orderBy(asc(stories.seriesPosition), desc(stories.updatedAt));
    return {
      series: mine.map((row) => ({ ...row, parts: storyRows.filter((story) => story.seriesId === row.id) })),
      unassigned: storyRows.filter((story) => !story.seriesId),
    };
  });
}
