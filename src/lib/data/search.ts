import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import type { Locale } from "@/lib/domain/locale";
import { INFLUENCE_KINDS } from "@/lib/domain/profile";
import { isAllowedStoryImage } from "@/lib/story-images";
import { donorActiveRaw, publishedCountRaw } from "./badge-sql";

/**
 * Public search across stories, people and topics. Runs as `anon`, so only
 * published stories can ever match. Stories use the full-text index (Spanish
 * and English stemming, accent-insensitive) plus title similarity for typos;
 * people match by name or by an influence they list (books, movies, music,
 * politics); topics by name. Results are cached briefly per query.
 */

type StoryRow = {
  title: string;
  subtitle: string;
  slug: string;
  language: Locale;
  reading_time: number;
  published_at: Date | null;
  content_text: string;
  thumbnail_url: string | null;
  thumbnail_alt: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  pronouns: string;
  published_count: number;
  donor_active: boolean;
  founding_number: number | null;
};

type PersonRow = {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  pronouns: string;
  published_count: number;
  donor_active: boolean;
  founding_number: number | null;
  /** The influence that matched the search, when it wasn't the name. */
  influence_kind: string | null;
  influence: string | null;
};
type TopicRow = { slug: string; name_en: string; name_es: string };
type CircleRow = { slug: string; name: string; description: string; accent_color: string };

export async function search(query: string, lang: "all" | Locale) {
  "use cache";
  cacheLife("minutes");
  cacheTag("stories", "search");

  const q = query.trim();
  if (!q) return { stories: [], people: [], topics: [], circles: [] };
  const language = lang === "all" ? null : lang;

  return asAnon(async (tx) => {
    const storyRows = await tx.execute<StoryRow>(sql`
      with query as (
        select
          public.f_unaccent(lower(${q})) as plain,
          websearch_to_tsquery('pg_catalog.english', public.f_unaccent(${q}))
            || websearch_to_tsquery('pg_catalog.spanish', public.f_unaccent(${q})) as ts
      )
      select s.title, s.subtitle, s.slug, s.language, s.reading_time, s.published_at,
             left(s.content_text, 400) as content_text, s.thumbnail_url, s.thumbnail_alt,
             p.username, p.display_name, p.avatar_url, p.pronouns, ${donorActiveRaw("p")} as donor_active, p.founding_number,
             ${publishedCountRaw("p")} as published_count
      from public.stories s
      join public.profiles p on p.id = s.author_id
      cross join query
      where s.status = 'published'
        and s.deleted_at is null
        and s.published_at <= now()
        and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id)
        and (${language}::text is null or s.language::text = ${language}::text)
        and (
          s.search_vector @@ query.ts
          or extensions.word_similarity(query.plain, public.f_unaccent(lower(s.title))) > 0.45
        )
      order by
        ts_rank(s.search_vector, query.ts)
          + extensions.word_similarity(query.plain, public.f_unaccent(lower(s.title))) * 0.5 desc,
        s.published_at desc
      limit 20
    `);

    // Influences are short lists in a jsonb object; anything malformed (it can be written through the
    // Data API) simply doesn't match. Queries under 3 characters only match names.
    const people = await tx.execute<PersonRow>(sql`
      with query as (select public.f_unaccent(lower(${q})) as plain)
      select pr.username, pr.display_name, pr.bio, pr.avatar_url, pr.pronouns, ${donorActiveRaw("pr")} as donor_active, pr.founding_number,
             ${publishedCountRaw("pr")} as published_count, inf.kind as influence_kind, inf.item as influence
      from public.profiles pr
      cross join query
      left join lateral (
        select e.key as kind, v.item,
               extensions.word_similarity(query.plain, public.f_unaccent(lower(v.item))) as score
        from jsonb_each(case when jsonb_typeof(pr.influences) = 'object' then pr.influences else '{}'::jsonb end) e
        cross join lateral jsonb_array_elements_text(
          case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end
        ) as v(item)
        where e.key in ('books', 'movies', 'music', 'politics')
          and char_length(query.plain) >= 3
          and char_length(v.item) <= 80
          and (
            strpos(public.f_unaccent(lower(v.item)), query.plain) > 0
            or extensions.word_similarity(query.plain, public.f_unaccent(lower(v.item))) > 0.6
          )
        order by score desc
        limit 1
      ) inf on true
      where strpos(lower(pr.username), query.plain) > 0
         or strpos(public.f_unaccent(lower(pr.display_name)), query.plain) > 0
         or extensions.similarity(lower(pr.username), query.plain) > 0.35
         or extensions.word_similarity(query.plain, public.f_unaccent(lower(pr.display_name))) > 0.5
         or inf.item is not null
      order by greatest(
        extensions.similarity(lower(pr.username), query.plain),
        extensions.word_similarity(query.plain, public.f_unaccent(lower(pr.display_name))),
        coalesce(inf.score, 0) * 0.9
      ) desc, pr.username
      limit 10
    `);

    const topicRows = await tx.execute<TopicRow>(sql`
      with query as (select public.f_unaccent(lower(${q})) as plain)
      select t.slug, t.name_en, t.name_es
      from public.topics t
      cross join query
      where strpos(public.f_unaccent(lower(t.name_en)), query.plain) > 0
         or strpos(public.f_unaccent(lower(t.name_es)), query.plain) > 0
         or strpos(query.plain, public.f_unaccent(lower(t.name_en))) > 0
         or strpos(query.plain, public.f_unaccent(lower(t.name_es))) > 0
      order by t.slug
      limit 6
    `);

    const circleRows = await tx.execute<CircleRow>(sql`
      with query as (select public.f_unaccent(lower(${q})) as plain)
      select c.slug, c.name, c.description, c.accent_color
      from public.circles c
      cross join query
      where strpos(public.f_unaccent(lower(c.name)), query.plain) > 0
         or strpos(public.f_unaccent(lower(c.description)), query.plain) > 0
         or extensions.word_similarity(query.plain, public.f_unaccent(lower(c.name))) > 0.5
      order by extensions.word_similarity(query.plain, public.f_unaccent(lower(c.name))) desc, c.name
      limit 6
    `);

    return {
      circles: circleRows.map((row) => ({ slug: row.slug, name: row.name, description: row.description, accentColor: row.accent_color })),
      stories: storyRows.map((row) => ({
        title: row.title,
        subtitle: row.subtitle,
        slug: row.slug,
        language: row.language,
        readingTime: row.reading_time,
        publishedAt: row.published_at ? new Date(row.published_at) : null,
        excerpt: excerpt(row.content_text),
        thumbnail:
          row.thumbnail_url && isAllowedStoryImage(row.thumbnail_url)
            ? { url: row.thumbnail_url, alt: row.thumbnail_alt }
            : null,
        author: {
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          pronouns: row.pronouns,
          badges: badgeData({ publishedCount: row.published_count, donorActive: row.donor_active, foundingNumber: row.founding_number }),
        },
      })),
      people: people.map((row) => {
        const kind = INFLUENCE_KINDS.find((k) => k === row.influence_kind);
        // Show which influence matched only when the name didn't.
        const nameMatched =
          row.username.toLowerCase().includes(q.toLowerCase()) || row.display_name.toLowerCase().includes(q.toLowerCase());
        return {
          username: row.username,
          displayName: row.display_name,
          bio: row.bio,
          avatarUrl: row.avatar_url,
          pronouns: row.pronouns,
          badges: badgeData({ publishedCount: row.published_count, donorActive: row.donor_active, foundingNumber: row.founding_number }),
          influence: kind && row.influence && !nameMatched ? { kind, item: row.influence } : null,
        };
      }),
      topics: topicRows.map((row) => ({ slug: row.slug, nameEn: row.name_en, nameEs: row.name_es })),
    };
  });
}
