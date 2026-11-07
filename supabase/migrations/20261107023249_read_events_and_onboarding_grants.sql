-- Onboarding ---------------------------------------------------------------------
-- Everyone who signed up before onboarding existed has, in effect, done it.
update public.profiles set onboarded_at = created_at where onboarded_at is null;
--> statement-breakpoint
grant update (onboarded_at, reading_languages) on public.profiles to authenticated;
--> statement-breakpoint

-- Reads ---------------------------------------------------------------------------
-- One row per story, reader and day: how far they got and for how long. `viewer_hash` is an HMAC
-- of the day and the person (their id, or their IP when signed out) made by the server, so no IP
-- is stored and one reader's days can't be linked. Powers Burning now (and writer stats later).
-- Written only through record_read(); nobody can read the table directly.
create table public.read_events (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_hash text not null check (char_length(viewer_hash) between 16 and 128),
  read_ratio real not null check (read_ratio between 0 and 1),
  seconds integer not null default 0 check (seconds between 0 and 86400),
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--> statement-breakpoint
create unique index read_events_story_viewer_day on public.read_events (story_id, viewer_hash, day);
--> statement-breakpoint
create index read_events_recent on public.read_events (updated_at) where read_ratio >= 0.5;
--> statement-breakpoint
alter table public.read_events enable row level security;
--> statement-breakpoint
revoke all on public.read_events from anon, authenticated;
--> statement-breakpoint

-- Records (or extends) today's read of a live story. Writers reading their own story don't count.
-- Returns whether anything was recorded.
create or replace function public.record_read(story uuid, viewer text, ratio real, read_seconds integer, reader uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.stories s
    where s.id = story
      and s.deleted_at is null
      and s.status in ('published', 'unlisted')
      and s.published_at <= now()
      and (reader is null or s.author_id <> reader)
  ) then
    return false;
  end if;
  insert into public.read_events (story_id, viewer_hash, read_ratio, seconds)
  values (story, viewer, least(greatest(ratio, 0), 1), least(greatest(read_seconds, 0), 86400))
  on conflict (story_id, viewer_hash, day) do update
    set read_ratio = greatest(public.read_events.read_ratio, excluded.read_ratio),
        seconds = greatest(public.read_events.seconds, excluded.seconds),
        updated_at = now();
  return true;
end;
$$;
--> statement-breakpoint
revoke execute on function public.record_read(uuid, text, real, integer, uuid) from public;
--> statement-breakpoint
grant execute on function public.record_read(uuid, text, real, integer, uuid) to anon, authenticated;
--> statement-breakpoint

-- Kept 13 months (enough for a year of writer stats); the daily cron prunes the rest. Owner only.
create or replace function public.prune_read_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.read_events where day < (now() at time zone 'utc')::date - interval '13 months' returning 1
  )
  select count(*)::integer from gone;
$$;
--> statement-breakpoint
revoke execute on function public.prune_read_events() from public, anon, authenticated;
--> statement-breakpoint

-- Burning now ------------------------------------------------------------------------
-- How much each story is burning: sparkers (more sparks count a little more), responses from
-- others, saves and reads past half the story, each fading by half every 36 hours, over the last
-- `since`. Returns one number per story with any activity and nothing about who did what, so
-- anyone may call it (saves and reads are private tables).
create or replace function public.story_heat(since interval default interval '14 days')
returns table (story_id uuid, heat double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select a.story_id, sum(a.weight * power(0.5, extract(epoch from (now() - a.at)) / 129600.0)) as heat
  from (
    select sp.story_id, sp.updated_at as at, 2 + least(sp.count, 50) / 25.0 as weight
    from public.sparks sp where sp.updated_at > now() - since
    union all
    select r.story_id, r.created_at, 3
    from public.responses r join public.stories s on s.id = r.story_id
    where r.created_at > now() - since and r.deleted_at is null and r.author_id <> s.author_id
    union all
    select b.story_id, b.created_at, 2.5
    from public.bookmarks b where b.created_at > now() - since
    union all
    select re.story_id, re.updated_at, 1
    from public.read_events re where re.updated_at > now() - since and re.read_ratio >= 0.5
  ) a
  group by a.story_id;
$$;
--> statement-breakpoint
revoke execute on function public.story_heat(interval) from public;
--> statement-breakpoint
grant execute on function public.story_heat(interval) to anon, authenticated;
