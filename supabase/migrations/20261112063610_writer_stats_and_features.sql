-- Writer stats -------------------------------------------------------------------------
-- Reads have been recorded since read_events existed; these functions let a writer see them, as
-- totals only. Every function works on the calling writer's own stories (auth.uid()), so a
-- signed-out caller or someone else's story gets zeros. read_events and highlights stay closed to
-- direct reads.

create index read_events_story_day on public.read_events (story_id, day);
--> statement-breakpoint

-- Per UTC day over the last `days` days (today included): visits, reads (past half the story) and
-- the seconds spent by readers who read. `story` narrows it to one of the writer's stories.
create or replace function public.writer_daily_reads(days integer default 30, story uuid default null)
returns table (day date, views integer, reads integer, read_seconds bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.day::date,
    count(re.id)::int,
    (count(re.id) filter (where re.read_ratio >= 0.5))::int,
    coalesce(sum(re.seconds) filter (where re.read_ratio >= 0.5), 0)::bigint
  from generate_series(
    (now() at time zone 'utc')::date - (least(greatest(days, 1), 400) - 1),
    (now() at time zone 'utc')::date,
    interval '1 day'
  ) as d(day)
  left join public.read_events re
    on re.day = d.day::date
    and re.story_id in (
      select s.id from public.stories s
      where s.author_id = auth.uid() and (story is null or s.id = story)
    )
  group by d.day
  order by d.day;
$$;
--> statement-breakpoint

-- Lifetime numbers for each story the writer has published (reads go back 13 months, the
-- retention of read_events): visits, reads, average reading time of readers who read, sparks,
-- people who sparked, responses from others, people who saved it and people who kept an ember.
create or replace function public.writer_story_totals()
returns table (
  story_id uuid,
  views integer,
  reads integer,
  avg_read_seconds integer,
  sparks integer,
  sparkers integer,
  responses integer,
  saves integer,
  ember_readers integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    (select count(*)::int from public.read_events re where re.story_id = s.id),
    (select count(*)::int from public.read_events re where re.story_id = s.id and re.read_ratio >= 0.5),
    (select coalesce(round(avg(re.seconds)), 0)::int from public.read_events re where re.story_id = s.id and re.read_ratio >= 0.5),
    (select coalesce(sum(sp.count), 0)::int from public.sparks sp where sp.story_id = s.id),
    (select count(*)::int from public.sparks sp where sp.story_id = s.id),
    (select count(*)::int from public.responses r where r.story_id = s.id and r.deleted_at is null and r.author_id <> s.author_id),
    (select count(distinct b.user_id)::int from public.bookmarks b where b.story_id = s.id),
    (select count(distinct h.user_id)::int from public.highlights h where h.story_id = s.id)
  from public.stories s
  where s.author_id = auth.uid()
    and s.deleted_at is null
    and s.published_at is not null
    and s.published_at <= now();
$$;
--> statement-breakpoint

-- How far visitors to one story got: all visits, then how many reached a quarter, half, three
-- quarters and (nearly) the end of the page. Ratios are real, so 0.9 is compared as a real too.
create or replace function public.writer_read_depth(story uuid)
returns table (visitors integer, quarter integer, half integer, three_quarters integer, finished integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::int,
    (count(*) filter (where re.read_ratio >= 0.25))::int,
    (count(*) filter (where re.read_ratio >= 0.5))::int,
    (count(*) filter (where re.read_ratio >= 0.75))::int,
    (count(*) filter (where re.read_ratio >= 0.9::real))::int
  from public.read_events re
  where re.story_id = story
    and exists (select 1 from public.stories s where s.id = story and s.author_id = auth.uid());
$$;
--> statement-breakpoint

-- Paragraphs of one story that two or more readers kept as embers, most loved first. Only the
-- count: never who, never which words they picked (embers stay private).
create or replace function public.writer_loved_passages(story uuid)
returns table (block_id text, readers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.block_id, count(distinct h.user_id)::int
  from public.highlights h
  join public.stories s on s.id = h.story_id
  where h.story_id = story and s.author_id = auth.uid()
  group by h.block_id
  having count(distinct h.user_id) >= 2
  order by 2 desc, h.block_id
  limit 5;
$$;
--> statement-breakpoint

revoke execute on function public.writer_daily_reads(integer, uuid) from public, anon;
--> statement-breakpoint
revoke execute on function public.writer_story_totals() from public, anon;
--> statement-breakpoint
revoke execute on function public.writer_read_depth(uuid) from public, anon;
--> statement-breakpoint
revoke execute on function public.writer_loved_passages(uuid) from public, anon;
--> statement-breakpoint
grant execute on function public.writer_daily_reads(integer, uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.writer_story_totals() to authenticated;
--> statement-breakpoint
grant execute on function public.writer_read_depth(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.writer_loved_passages(uuid) to authenticated;
--> statement-breakpoint

-- Featured weekly spark entries -----------------------------------------------------------
revoke all on public.prompt_features from anon, authenticated;
--> statement-breakpoint
grant select on public.prompt_features to anon, authenticated;
--> statement-breakpoint
grant insert, delete on public.prompt_features to authenticated;
--> statement-breakpoint

-- A featured entry is a live story that answers that spark, at most three per spark, and records
-- which admin featured it.
create or replace function public.check_prompt_feature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('prompt_features:' || new.prompt_id::text));
  if not exists (
    select 1 from public.stories s
    where s.id = new.story_id
      and s.prompt_id = new.prompt_id
      and s.deleted_at is null
      and s.status = 'published'
      and s.published_at <= now()
  ) then
    raise exception 'only live entries of this spark can be featured' using errcode = '23514';
  end if;
  if (select count(*) from public.prompt_features f where f.prompt_id = new.prompt_id) >= 3 then
    raise exception 'a spark features at most three entries' using errcode = '23514';
  end if;
  new.featured_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
--> statement-breakpoint
create trigger prompt_features_check
  before insert on public.prompt_features
  for each row execute function public.check_prompt_feature();
--> statement-breakpoint

-- Tells the writer (a notification without actors, like badges). The ON CONFLICT target lists the
-- notifications_unread_group_key expressions, like notify() and notify_badge().
create or replace function public.notify_featured()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
begin
  select s.author_id into author from public.stories s where s.id = new.story_id;
  if author is null then
    return null;
  end if;
  insert into public.notifications (user_id, type, story_id, actor_ids, actor_count)
  values (author, 'featured', new.story_id, '{}', 0)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  do update set updated_at = now(), emailed_at = null;
  return null;
end;
$$;
--> statement-breakpoint
create trigger prompt_features_notify
  after insert on public.prompt_features
  for each row execute function public.notify_featured();
--> statement-breakpoint

-- Taking a feature back (usually a slip) also takes back the news, if the writer hasn't seen it.
create or replace function public.unnotify_featured()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
  where n.type = 'featured' and n.story_id = old.story_id and n.read_at is null;
  return null;
end;
$$;
--> statement-breakpoint
create trigger prompt_features_unnotify
  after delete on public.prompt_features
  for each row execute function public.unnotify_featured();
--> statement-breakpoint
revoke execute on function public.check_prompt_feature() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.notify_featured() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.unnotify_featured() from public, anon, authenticated;
