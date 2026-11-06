-- Word counts for profiles, and grants for the new profile fields.

-- Same rule as countWords() in src/lib/domain/content.ts: a run of letters or digits, with inner
-- apostrophes and hyphens ("rock'n'roll", "well-known" count once). The explicit Latin ranges keep
-- accented words whole even under a byte-only locale. A db test compares the two.
create or replace function public.count_words(body text)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select count(*)::int
  from regexp_matches(coalesce(body, ''), '[[:alnum:]À-ÖØ-öø-ɏ][[:alnum:]À-ÖØ-öø-ɏ''’-]*', 'g');
$$;
--> statement-breakpoint

-- Generated from the live text (pending edits don't count until published), so it can't be set by
-- hand and existing stories are counted right away. Like search_vector, it lives outside the Drizzle
-- schema; read it as "stories"."word_count".
alter table public.stories
  add column word_count integer generated always as (public.count_words(content_text)) stored;
--> statement-breakpoint

-- People edit their own pronouns, "Now" line and influences (profiles_update_own limits it to their row).
grant update (pronouns, now_focus, now_text, influences) on public.profiles to authenticated;
