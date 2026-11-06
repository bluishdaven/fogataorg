import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";

type Row = { key: string; last: Date | string | null };

/**
 * What search engines should crawl: live public stories (not unlisted, not moderated, no outside
 * canonical), the profiles that list them, and the topics and circles that have stories. Runs as
 * anon, so drafts and scheduled stories can't leak in.
 */
export async function sitemapData() {
  "use cache";
  cacheLife("hours");
  cacheTag("stories", "circles", "topics");

  return asAnon(async (tx) => {
    const live = sql`s.status = 'published' and s.deleted_at is null and s.published_at <= now()`;
    const unmoderated = sql`not exists (select 1 from public.story_moderation sm where sm.story_id = s.id)`;
    const notRemoved = sql`not exists (select 1 from public.story_moderation sm where sm.story_id = s.id and sm.status = 'removed')`;

    const stories = await tx.execute<{ username: string; slug: string; published_at: Date | string }>(sql`
      select p.username, s.slug, s.published_at
      from public.stories s
      join public.profiles p on p.id = s.author_id
      where ${live} and ${unmoderated} and s.canonical_url is null
      order by s.published_at desc
      limit 40000
    `);
    const profiles = await tx.execute<Row>(sql`
      select p.username as key, max(s.published_at) as last
      from public.profiles p
      join public.stories s on s.author_id = p.id
      where ${live} and ${notRemoved}
      group by p.username
    `);
    const topics = await tx.execute<Row>(sql`
      select t.slug as key, max(s.published_at) as last
      from public.topics t
      join public.story_topics st on st.topic_id = t.id
      join public.stories s on s.id = st.story_id
      where ${live} and ${unmoderated}
      group by t.slug
    `);
    const circles = await tx.execute<Row>(sql`
      select c.slug as key, max(s.published_at) as last
      from public.circles c
      join public.circle_submissions cs on cs.circle_id = c.id and cs.status = 'accepted'
      join public.stories s on s.id = cs.story_id
      where ${live} and ${unmoderated}
      group by c.slug
    `);

    const date = (value: Date | string | null) => (value ? new Date(value) : undefined);
    return {
      stories: stories.map((row) => ({ username: row.username, slug: row.slug, lastModified: date(row.published_at) })),
      profiles: profiles.map((row) => ({ username: row.key, lastModified: date(row.last) })),
      topics: topics.map((row) => ({ slug: row.key, lastModified: date(row.last) })),
      circles: circles.map((row) => ({ slug: row.key, lastModified: date(row.last) })),
    };
  });
}
