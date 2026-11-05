import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { excerpt } from "@/lib/domain/content";
import type { Locale } from "@/lib/domain/locale";
import { isAllowedStoryImage } from "@/lib/story-images";

/**
 * Public search across stories, people and topics. Runs as `anon`, so only
 * published stories can ever match. Stories use the full-text index (Spanish
 * and English stemming, accent-insensitive) plus title similarity for typos;
 * people and topics match by name. Results are cached briefly per query.
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
};

type PersonRow = { username: string; display_name: string; bio: string };
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
             p.username, p.display_name
      from public.stories s
      join public.profiles p on p.id = s.author_id
      cross join query
      where s.status = 'published'
        and s.deleted_at is null
        and s.published_at <= now()
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

    const people = await tx.execute<PersonRow>(sql`
      with query as (select public.f_unaccent(lower(${q})) as plain)
      select pr.username, pr.display_name, pr.bio
      from public.profiles pr
      cross join query
      where strpos(lower(pr.username), query.plain) > 0
         or strpos(public.f_unaccent(lower(pr.display_name)), query.plain) > 0
         or extensions.similarity(lower(pr.username), query.plain) > 0.35
         or extensions.word_similarity(query.plain, public.f_unaccent(lower(pr.display_name))) > 0.5
      order by greatest(
        extensions.similarity(lower(pr.username), query.plain),
        extensions.word_similarity(query.plain, public.f_unaccent(lower(pr.display_name)))
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
        author: { username: row.username, displayName: row.display_name },
      })),
      people: people.map((row) => ({ username: row.username, displayName: row.display_name, bio: row.bio })),
      topics: topicRows.map((row) => ({ slug: row.slug, nameEn: row.name_en, nameEs: row.name_es })),
    };
  });
}
