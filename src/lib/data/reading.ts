import "server-only";
import { and, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles, readingPositions, stories } from "@/lib/db/schema";
import type { ReadingPosition } from "@/lib/domain/reading-position";
import { notRemoved } from "./moderation-sql";

/** Saves where the reader is in a story (live stories only; RLS checks). */
export async function savePosition(viewer: Viewer, storyId: string, position: ReadingPosition) {
  await withRls(viewer.claims, (tx) =>
    tx
      .insert(readingPositions)
      .values({ userId: viewer.id, storyId, blockId: position.blockId, progress: position.progress })
      .onConflictDoUpdate({
        target: [readingPositions.userId, readingPositions.storyId],
        set: { blockId: position.blockId, progress: position.progress, updatedAt: sql`now()` },
      }),
  );
}

export async function getPosition(viewer: Viewer, storyId: string): Promise<ReadingPosition | null> {
  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .select({ blockId: readingPositions.blockId, progress: readingPositions.progress })
      .from(readingPositions)
      .where(and(eq(readingPositions.userId, viewer.id), eq(readingPositions.storyId, storyId)))
      .limit(1),
  );
  return row ?? null;
}

/** Stories the reader started in the last 30 days and hasn't finished, newest first. */
export async function listContinueReading(viewer: Viewer, limit = 3) {
  return withRls(viewer.claims, (tx) =>
    tx
      .select({
        blockId: readingPositions.blockId,
        progress: readingPositions.progress,
        title: stories.title,
        slug: stories.slug,
        language: stories.language,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
      })
      .from(readingPositions)
      .innerJoin(stories, eq(stories.id, readingPositions.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(
        and(
          eq(readingPositions.userId, viewer.id),
          gte(readingPositions.progress, 0.05),
          lt(readingPositions.progress, 0.95),
          sql`${readingPositions.updatedAt} > now() - interval '30 days'`,
          isNull(stories.deletedAt),
          lte(stories.publishedAt, sql`now()`),
          sql`${stories.status} in ('published', 'unlisted')`,
          notRemoved,
        ),
      )
      .orderBy(desc(readingPositions.updatedAt))
      .limit(limit),
  );
}
