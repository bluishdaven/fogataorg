import "server-only";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { highlights, profiles, stories } from "@/lib/db/schema";
import { notRemoved } from "./moderation-sql";

export type StoryHighlight = { id: string; blockId: string; start: number; end: number; quote: string };

/** The reader's embers in one story, in reading order. */
export async function listStoryHighlights(viewer: Viewer | null, storyId: string): Promise<StoryHighlight[]> {
  if (!viewer) return [];
  return withRls(viewer.claims, (tx) =>
    tx
      .select({ id: highlights.id, blockId: highlights.blockId, start: highlights.startOffset, end: highlights.endOffset, quote: highlights.quote })
      .from(highlights)
      .where(and(eq(highlights.userId, viewer.id), eq(highlights.storyId, storyId)))
      .orderBy(asc(highlights.createdAt)),
  );
}

/** Every ember the reader kept, newest first, with its story (live stories only). */
export async function listMyEmbers(viewer: Viewer) {
  const rows = await withRls(viewer.claims, (tx) =>
    tx
      .select({
        id: highlights.id,
        blockId: highlights.blockId,
        quote: highlights.quote,
        createdAt: highlights.createdAt,
        storyId: stories.id,
        title: stories.title,
        slug: stories.slug,
        language: stories.language,
        authorUsername: profiles.username,
        authorDisplayName: profiles.displayName,
      })
      .from(highlights)
      .innerJoin(stories, eq(stories.id, highlights.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(
        and(
          eq(highlights.userId, viewer.id),
          isNull(stories.deletedAt),
          lte(stories.publishedAt, sql`now()`),
          sql`${stories.status} in ('published', 'unlisted')`,
          notRemoved,
        ),
      )
      .orderBy(desc(highlights.createdAt))
      .limit(500),
  );
  return rows;
}
