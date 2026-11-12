-- Founding writers ---------------------------------------------------------------------------
-- The first 100 writers to reach five published, public stories (the count writing tiers use)
-- get a numbered founding badge, kept for good. It's checked wherever writing tiers are: story and
-- moderation triggers, and the daily cron for scheduled stories (all through check_writing_badge).
-- profiles.founding_number has no column grant, so nobody can set it but these functions.

create or replace function public.check_founding_writer(author uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  if author is null then
    return;
  end if;
  if exists (select 1 from public.profiles p where p.id = author and p.founding_number is not null) then
    return;
  end if;
  if public.published_story_count(author) < 5 then
    return;
  end if;
  -- One at a time, so two writers reaching five stories together can't take the same number.
  perform pg_advisory_xact_lock(hashtext('founding_writers'));
  select coalesce(max(p.founding_number), 0) + 1 into next_number from public.profiles p;
  if next_number > 100 then
    return;
  end if;
  update public.profiles set founding_number = next_number
  where id = author and founding_number is null;
  if found then
    perform public.notify_badge(author, 'founding', 'founding');
  end if;
end;
$$;
--> statement-breakpoint

-- Same as before, plus the founding check.
create or replace function public.check_writing_badge(author uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reached integer;
begin
  if author is null then
    return;
  end if;
  reached := public.writing_tier_min(public.published_story_count(author));
  update public.profiles set badge_tier_notified = reached
  where id = author and badge_tier_notified < reached;
  if found then
    perform public.notify_badge(author, 'badge', public.writing_tier_key(reached));
  end if;
  perform public.check_founding_writer(author);
end;
$$;
--> statement-breakpoint

revoke execute on function public.check_founding_writer(uuid) from public, anon, authenticated;
--> statement-breakpoint

-- Writers who already have five stories, in the order they reached their fifth.
do $$
declare
  writer record;
begin
  for writer in
    select ranked.author_id
    from (
      select
        st.author_id,
        st.published_at,
        row_number() over (partition by st.author_id order by st.published_at, st.id) as n
      from public.stories st
      where st.status = 'published'
        and st.deleted_at is null
        and st.published_at <= now()
        and not exists (select 1 from public.story_moderation sm where sm.story_id = st.id and sm.status = 'removed')
    ) ranked
    where ranked.n = 5
    order by ranked.published_at
  loop
    perform public.check_founding_writer(writer.author_id);
  end loop;
end;
$$;
