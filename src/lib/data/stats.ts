import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { stories } from "@/lib/db/schema";
import type { TiptapDoc } from "@/lib/domain/content";
import { blockTexts } from "@/lib/domain/social";
import { lovedPassages, STATS_PERIOD_DAYS, type DailyReads, type ReadDepth } from "@/lib/domain/stats";

/**
 * A writer's own stats. Everything runs as the signed-in writer through the writer_* functions,
 * which only ever count that writer's stories and only return totals. Never cached.
 */

type DailyRow = { day: string; views: number; reads: number; read_seconds: string | number };

const toDaily = (row: DailyRow): DailyReads => ({
  day: row.day,
  views: Number(row.views),
  reads: Number(row.reads),
  readSeconds: Number(row.read_seconds),
});

export type StoryTotals = {
  storyId: string;
  title: string;
  slug: string;
  language: "en" | "es";
  status: string;
  publishedAt: Date | null;
  views: number;
  reads: number;
  avgReadSeconds: number;
  sparks: number;
  sparkers: number;
  responses: number;
  saves: number;
  emberReaders: number;
};

type TotalsRow = {
  story_id: string;
  title: string;
  slug: string;
  language: "en" | "es";
  status: string;
  published_at: string | Date | null;
  views: number;
  reads: number;
  avg_read_seconds: number;
  sparks: number;
  sparkers: number;
  responses: number;
  saves: number;
  ember_readers: number;
};

const toTotals = (row: TotalsRow): StoryTotals => ({
  storyId: row.story_id,
  title: row.title,
  slug: row.slug,
  language: row.language,
  status: row.status,
  publishedAt: row.published_at ? new Date(row.published_at) : null,
  views: Number(row.views),
  reads: Number(row.reads),
  avgReadSeconds: Number(row.avg_read_seconds),
  sparks: Number(row.sparks),
  sparkers: Number(row.sparkers),
  responses: Number(row.responses),
  saves: Number(row.saves),
  emberReaders: Number(row.ember_readers),
});

/** The last two periods of daily reads, every published story's totals and follower counts. */
export async function getWriterOverview(viewer: Viewer) {
  return withRls(viewer.claims, async (tx) => {
    const daily = await tx.execute<DailyRow>(
      sql`select day::text as day, views, reads, read_seconds from public.writer_daily_reads(${STATS_PERIOD_DAYS * 2}::integer, null)`,
    );
    const totals = await tx.execute<TotalsRow>(sql`
      select t.*, s.title, s.slug, s.language, s.status, s.published_at
      from public.writer_story_totals() t
      join public.stories s on s.id = t.story_id
      order by s.published_at desc
    `);
    const [followers] = await tx.execute<{ total: number; current: number; previous: number }>(sql`
      select
        count(*)::int as total,
        (count(*) filter (where f.created_at > now() - make_interval(days => ${STATS_PERIOD_DAYS}::integer)))::int as current,
        (count(*) filter (
          where f.created_at <= now() - make_interval(days => ${STATS_PERIOD_DAYS}::integer)
            and f.created_at > now() - make_interval(days => ${STATS_PERIOD_DAYS * 2}::integer)
        ))::int as previous
      from public.follows f
      where f.followed_user_id = ${viewer.id}
    `);
    return {
      daily: daily.map(toDaily),
      stories: totals.map(toTotals),
      followers: {
        total: Number(followers?.total ?? 0),
        current: Number(followers?.current ?? 0),
        previous: Number(followers?.previous ?? 0),
      },
    };
  });
}

/** One of the writer's published stories: its last 30 days, totals, read depth and loved paragraphs. */
export async function getStoryStats(viewer: Viewer, storyId: string) {
  return withRls(viewer.claims, async (tx) => {
    const [story] = await tx
      .select({
        id: stories.id,
        title: stories.title,
        slug: stories.slug,
        language: stories.language,
        status: stories.status,
        content: stories.content,
        publishedAt: stories.publishedAt,
      })
      .from(stories)
      .where(
        and(
          eq(stories.id, storyId),
          eq(stories.authorId, viewer.id),
          isNull(stories.deletedAt),
          isNotNull(stories.publishedAt),
          sql`${stories.publishedAt} <= now()`,
        ),
      )
      .limit(1);
    if (!story) return null;

    const daily = await tx.execute<DailyRow>(
      sql`select day::text as day, views, reads, read_seconds from public.writer_daily_reads(${STATS_PERIOD_DAYS}::integer, ${storyId}::uuid)`,
    );
    const [totals] = await tx.execute<TotalsRow>(sql`
      select t.*, s.title, s.slug, s.language, s.status, s.published_at
      from public.writer_story_totals() t
      join public.stories s on s.id = t.story_id
      where t.story_id = ${storyId}::uuid
    `);
    const [depth] = await tx.execute<{ visitors: number; quarter: number; half: number; three_quarters: number; finished: number }>(
      sql`select * from public.writer_read_depth(${storyId}::uuid)`,
    );
    const loved = await tx.execute<{ block_id: string; readers: number }>(
      sql`select block_id, readers from public.writer_loved_passages(${storyId}::uuid)`,
    );

    const readDepth: ReadDepth = {
      visitors: Number(depth?.visitors ?? 0),
      quarter: Number(depth?.quarter ?? 0),
      half: Number(depth?.half ?? 0),
      threeQuarters: Number(depth?.three_quarters ?? 0),
      finished: Number(depth?.finished ?? 0),
    };
    return {
      story: { id: story.id, title: story.title, slug: story.slug, language: story.language, status: story.status, publishedAt: story.publishedAt },
      daily: daily.map(toDaily),
      totals: totals ? toTotals(totals) : null,
      depth: readDepth,
      loved: lovedPassages(
        loved.map((row) => ({ blockId: row.block_id, readers: Number(row.readers) })),
        blockTexts(story.content as TiptapDoc & Parameters<typeof blockTexts>[0]),
      ),
    };
  });
}
