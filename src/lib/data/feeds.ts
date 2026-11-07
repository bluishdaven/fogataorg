import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles, stories } from "@/lib/db/schema";
import type { Locale } from "@/lib/domain/locale";
import { cardColumns, inFeeds, toCard } from "./stories";

/** Home page data that depends on the reader (Latest itself is `getLatestStories()`, cached). */

export type StoryCardData = ReturnType<typeof toCard>;
const FEED_SIZE = 30;

/** Stories from the writers, topics and circles the reader follows, newest first. */
export async function getFollowingStories(viewer: Viewer, limit = FEED_SIZE): Promise<StoryCardData[]> {
  const rows = await withRls(viewer.claims, (tx) =>
    tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(
        and(
          inFeeds,
          sql`(
            exists (select 1 from public.follows f where f.follower_id = ${viewer.id} and f.followed_user_id = "stories"."author_id")
            or exists (
              select 1 from public.story_topics st join public.follows f on f.followed_topic_id = st.topic_id
              where st.story_id = "stories"."id" and f.follower_id = ${viewer.id}
            )
            or exists (
              select 1 from public.circle_submissions cs join public.follows f on f.followed_circle_id = cs.circle_id
              where cs.story_id = "stories"."id" and cs.status = 'accepted' and f.follower_id = ${viewer.id}
            )
          )`,
        ),
      )
      .orderBy(desc(stories.publishedAt))
      .limit(limit),
  );
  return rows.map(toCard);
}

/** What the home page needs to know about the reader: their languages and whether they onboarded. */
export async function getReaderSettings(viewer: Viewer) {
  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .select({ readingLanguages: profiles.readingLanguages, onboardedAt: profiles.onboardedAt, locale: profiles.locale })
      .from(profiles)
      .where(eq(profiles.id, viewer.id))
      .limit(1),
  );
  return {
    readingLanguages: (row?.readingLanguages?.length ? row.readingLanguages : ["es", "en"]) as Locale[],
    onboarded: Boolean(row?.onboardedAt),
    locale: (row?.locale ?? "en") as Locale,
  };
}
