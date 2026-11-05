-- Search: full-text for stories (Spanish/English stemming, accent-insensitive) plus
-- trigram similarity for typo tolerance on titles, usernames and display names.
-- search_vector is managed here, not in the Drizzle schema (generated column; read via raw SQL).
create extension if not exists unaccent with schema extensions;
--> statement-breakpoint
create extension if not exists pg_trgm with schema extensions;
--> statement-breakpoint

-- unaccent() isn't immutable, so it can't be used in generated columns or indexes directly.
create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, value) $$;
--> statement-breakpoint

create or replace function public.story_search_config(language public.locale_code)
returns regconfig
language sql
immutable
parallel safe
as $$ select case when language = 'es' then 'pg_catalog.spanish'::regconfig else 'pg_catalog.english'::regconfig end $$;
--> statement-breakpoint

alter table public.stories
  add column search_vector tsvector generated always as (
    setweight(to_tsvector(public.story_search_config(language), public.f_unaccent(coalesce(title, ''))), 'A')
    || setweight(to_tsvector(public.story_search_config(language), public.f_unaccent(coalesce(subtitle, ''))), 'B')
    || setweight(to_tsvector(public.story_search_config(language), public.f_unaccent(left(coalesce(content_text, ''), 100000))), 'C')
  ) stored;
--> statement-breakpoint

create index stories_search_idx on public.stories using gin (search_vector);
--> statement-breakpoint
create index stories_title_trgm_idx on public.stories using gin (public.f_unaccent(lower(title)) extensions.gin_trgm_ops);
--> statement-breakpoint
create index profiles_username_trgm_idx on public.profiles using gin (lower(username) extensions.gin_trgm_ops);
--> statement-breakpoint
create index profiles_display_name_trgm_idx on public.profiles using gin (public.f_unaccent(lower(display_name)) extensions.gin_trgm_ops);
