import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { follows, profiles, topics } from "@/lib/db/schema";
import { badgeData } from "@/lib/domain/badges";
import type { Locale } from "@/lib/domain/locale";
import { donorActiveRaw, publishedCountRaw } from "./badge-sql";

/** What the welcome steps start from: the reader's languages and the topics they already follow. */
export async function getOnboardingState(viewer: Viewer) {
  return withRls(viewer.claims, async (tx) => {
    const [profile] = await tx
      .select({ locale: profiles.locale, readingLanguages: profiles.readingLanguages, onboardedAt: profiles.onboardedAt })
      .from(profiles)
      .where(eq(profiles.id, viewer.id))
      .limit(1);
    const followed = await tx
      .select({ slug: topics.slug })
      .from(follows)
      .innerJoin(topics, eq(topics.id, follows.followedTopicId))
      .where(eq(follows.followerId, viewer.id));
    return {
      locale: (profile?.locale ?? "en") as Locale,
      readingLanguages: (profile?.readingLanguages ?? ["es", "en"]) as Locale[],
      onboarded: Boolean(profile?.onboardedAt),
      topics: followed.map((row) => row.slug),
    };
  });
}

type WriterRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  pronouns: string;
  bio: string;
  published_count: number;
  donor_active: boolean;
  new_voice: boolean;
};

/**
 * Writers to follow, from the reader's topics and languages: the most sparked over the last 90
 * days, plus at least two newer voices (three or fewer stories, one in the last month). Leaves out the
 * reader and people they already follow. Tops up from everyone when the topics are quiet.
 */
export async function getSuggestedWriters(viewer: Viewer, topicSlugs: string[], languages: Locale[], limit = 8) {
  const rows = await withRls(viewer.claims, (tx) =>
    tx.execute<WriterRow>(sql`
      with candidates as (
        select p.id, p.username, p.display_name, p.avatar_url, p.pronouns, p.bio,
          ${publishedCountRaw("p")} as published_count,
          ${donorActiveRaw("p")} as donor_active,
          exists (
            select 1 from public.stories s join public.story_topics st on st.story_id = s.id
            join public.topics t on t.id = st.topic_id
            where s.author_id = p.id and t.slug = any(${`{${topicSlugs.join(",")}}`}::text[])
              and s.status = 'published' and s.deleted_at is null and s.published_at <= now()
              and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id)
          ) as in_topics,
          (select max(s.published_at) from public.stories s
            where s.author_id = p.id and s.status = 'published' and s.deleted_at is null and s.published_at <= now()
              and s.language = any(${`{${languages.join(",")}}`}::public.locale_code[])) as last_published,
          (select coalesce(sum(sp.count), 0) from public.sparks sp join public.stories s on s.id = sp.story_id
            where s.author_id = p.id and sp.updated_at > now() - interval '90 days') as sparks
        from public.profiles p
        where p.id <> ${viewer.id}
          and not exists (select 1 from public.follows f where f.follower_id = ${viewer.id} and f.followed_user_id = p.id)
      ),
      ranked as (
        select c.*, c.published_count <= 3 and c.last_published > now() - interval '30 days' as new_voice
        from candidates c
        where c.published_count > 0 and c.last_published is not null
      ),
      established as (
        select * from ranked where not new_voice
        order by in_topics desc, sparks desc, published_count desc, last_published desc
        limit ${limit}
      ),
      newer as (
        select * from ranked where new_voice
        order by in_topics desc, last_published desc
        limit ${limit}
      )
      select * from established
      union all
      select * from newer
    `),
  );
  // Up to two new voices always make the list; on a young site, where almost everyone is new,
  // they fill whatever the established writers leave.
  const established = rows.filter((row) => !row.new_voice);
  const newer = rows.filter((row) => row.new_voice);
  const keep = established.slice(0, Math.max(limit - 2, limit - newer.length));
  const picked = [...keep, ...newer.slice(0, limit - keep.length)];
  return picked.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    avatarUrl: row.avatar_url,
    pronouns: row.pronouns,
    bio: row.bio,
    newVoice: row.new_voice,
    badges: badgeData({ publishedCount: row.published_count, donorActive: row.donor_active }),
  }));
}
