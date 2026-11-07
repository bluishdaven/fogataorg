import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls, type RlsTransaction } from "@/lib/db/rls";
import { profiles, stories } from "@/lib/db/schema";
import { fillFeed } from "@/lib/domain/feeds";
import type { Locale } from "@/lib/domain/locale";
import { cardColumns, getLatestStories, inFeeds, toCard } from "./stories";

/**
 * Home feeds (plan: docs/plans/phase-3.md). Burning now is the same for everyone who reads the
 * same languages, so it's cached; For you and Following are per reader and run per request.
 */

export type StoryCardData = ReturnType<typeof toCard>;
const FEED_SIZE = 30;

/** A story counts as a new voice in its first week when its writer has three or fewer stories. */
const NEW_VOICE = sql.raw(`(
  s.published_at > now() - interval '7 days'
  and (select count(*) from public.stories ps where ps.author_id = s.author_id and ps.status = 'published'
       and ps.deleted_at is null and ps.published_at <= now()) <= 3
)`);

/** The listing rules (`inFeeds`) for raw queries over `public.stories s`. */
const LIVE_IN_FEEDS = sql.raw(`(
  s.status = 'published' and s.deleted_at is null and s.published_at <= now()
  and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id)
)`);

const languageList = (languages: Locale[]) => sql`${`{${languages.join(",")}}`}::public.locale_code[]`;

/** Cards for `ids`, in that order. */
async function cardsInOrder(tx: RlsTransaction, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ ...cardColumns, id: stories.id })
    .from(stories)
    .innerJoin(profiles, eq(profiles.id, stories.authorId))
    .where(and(inFeeds, inArray(stories.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, toCard(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

const keyed = (card: StoryCardData) => ({ ...card, key: `${card.author.username}/${card.slug}` });

/**
 * Burning now: activity over the last days (`public.story_heat()`, fading by half every 36 hours)
 * in the reader's languages, with new voices lifted by half again. Falls back to the newest stories
 * when nothing has happened lately.
 */
export async function getBurningStories(languages: Locale[], limit = 20): Promise<StoryCardData[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag("stories", "burning");

  const burning = await asAnon(async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      select s.id
      from public.story_heat() h
      join public.stories s on s.id = h.story_id
      where ${LIVE_IN_FEEDS} and s.language = any(${languageList(languages)})
      order by h.heat * case when ${NEW_VOICE} then 1.5 else 1 end desc, s.published_at desc
      limit ${limit}
    `);
    return cardsInOrder(tx, rows.map((row) => row.id));
  });
  if (burning.length >= 5) return burning;
  const latest = (await getLatestStories(limit)).filter((story) => languages.includes(story.language));
  return fillFeed(burning.map(keyed), latest.map(keyed), limit);
}

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

/**
 * For you: the last 30 days in the reader's languages (never their own stories), scored by how
 * fresh a story is, whether they follow its writer, topics or circle, how much it's burning and
 * whether it's a new voice. Topped up with the newest stories so it's never empty.
 */
export async function getForYouStories(viewer: Viewer, languages: Locale[], limit = FEED_SIZE): Promise<StoryCardData[]> {
  const picked = await withRls(viewer.claims, async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      with heat as (select * from public.story_heat())
      select s.id
      from public.stories s
      left join heat h on h.story_id = s.id
      where ${LIVE_IN_FEEDS}
        and s.published_at > now() - interval '30 days'
        and s.author_id <> ${viewer.id}
        and s.language = any(${languageList(languages)})
      order by (
        2 * power(0.5, extract(epoch from (now() - s.published_at)) / 172800.0)
        + case when exists (select 1 from public.follows f where f.follower_id = ${viewer.id} and f.followed_user_id = s.author_id) then 3 else 0 end
        + case when exists (
            select 1 from public.story_topics st join public.follows f on f.followed_topic_id = st.topic_id
            where st.story_id = s.id and f.follower_id = ${viewer.id}
          ) then 1.5 else 0 end
        + case when exists (
            select 1 from public.circle_submissions cs join public.follows f on f.followed_circle_id = cs.circle_id
            where cs.story_id = s.id and cs.status = 'accepted' and f.follower_id = ${viewer.id}
          ) then 1.5 else 0 end
        + 0.8 * ln(1 + coalesce(h.heat, 0))
        + case when ${NEW_VOICE} then 1 else 0 end
      ) desc, s.published_at desc
      limit ${limit}
    `);
    return cardsInOrder(tx, rows.map((row) => row.id));
  });
  if (picked.length >= limit) return picked;
  const latest = (await getLatestStories(limit)).filter(
    (story) => languages.includes(story.language) && story.author.username !== viewer.username,
  );
  return fillFeed(picked.map(keyed), latest.map(keyed), limit);
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
