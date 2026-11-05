-- Bell notifications for new badges: a writing tier reached for the first time, or the donor badge
-- granted. Writing tiers mirror WRITING_TIERS in src/lib/domain/badges.ts (a db test checks).

-- The minimum story count of the highest tier `n` published stories reach (0 before the first).
create or replace function public.writing_tier_min(n integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(max(m), 0) from unnest(array[1, 5, 12, 25, 50, 100, 200, 350, 600, 1000]) as m where m <= n;
$$;
--> statement-breakpoint

-- The tier key for a tier minimum (null for 0).
create or replace function public.writing_tier_key(tier_min integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['kindling', 'candle', 'flame', 'torch', 'hearth', 'bonfire', 'beacon', 'star', 'sun', 'phoenix'])[
    array_position(array[1, 5, 12, 25, 50, 100, 200, 350, 600, 1000], tier_min)
  ];
$$;
--> statement-breakpoint

-- The count writing tiers use: published, public, live, not deleted, not removed by moderation.
-- Same rule as publishedCountSql() in src/lib/data/badge-sql.ts.
create or replace function public.published_story_count(author uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.stories s
  where s.author_id = author
    and s.status = 'published'
    and s.deleted_at is null
    and s.published_at <= now()
    and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id and sm.status = 'removed');
$$;
--> statement-breakpoint

-- Adds (or refreshes, while unread) a badge notification. Badge notifications have no actors.
create or replace function public.notify_badge(recipient uuid, kind public.notification_type, badge_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null then
    return;
  end if;
  insert into public.notifications as n (user_id, type, badge, actor_ids, actor_count)
  values (recipient, kind, badge_key, '{}', 0)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  -- Still unread: show the newest badge, dated now, and include it in the next summary.
  do update set badge = excluded.badge, updated_at = now(), emailed_at = null;
end;
$$;
--> statement-breakpoint

-- Announces the writer's tier if it's higher than any tier they were told about before.
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
end;
$$;
--> statement-breakpoint

create or replace function public.on_story_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_writing_badge(new.author_id);
  return null;
end;
$$;
--> statement-breakpoint

create trigger stories_check_writing_badge
  after insert or update of status, published_at, deleted_at on public.stories
  for each row execute function public.on_story_badge();
--> statement-breakpoint

-- Lifting a removal can bring a writer back up to (or past) a tier.
create or replace function public.on_moderation_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_writing_badge(
    (select s.author_id from public.stories s where s.id = coalesce(new.story_id, old.story_id))
  );
  return null;
end;
$$;
--> statement-breakpoint

create trigger story_moderation_check_writing_badge
  after insert or update or delete on public.story_moderation
  for each row execute function public.on_moderation_badge();
--> statement-breakpoint

-- Scheduled stories go live without a write (no trigger fires), so the daily cron job calls this
-- for writers whose stories went live recently. Returns how many writers were checked.
create or replace function public.check_due_writing_badges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  writer uuid;
  checked integer := 0;
begin
  for writer in
    select distinct s.author_id
    from public.stories s
    where s.status = 'published'
      and s.deleted_at is null
      and s.published_at <= now()
      and s.published_at > now() - interval '3 days'
  loop
    perform public.check_writing_badge(writer);
    checked := checked + 1;
  end loop;
  return checked;
end;
$$;
--> statement-breakpoint

-- Granting the donor badge now also tells the donor (same function as before, plus notify_badge).
create or replace function public.grant_donor_badge(target uuid, note text default '')
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can grant donor badges' using errcode = '42501';
  end if;
  update public.profiles
  set donor_since = coalesce(donor_since, now()),
      donor_until = greatest(coalesce(donor_until, now()), now()) + interval '2 months'
  where id = target
  returning donor_until into until;
  if until is null then
    raise exception 'No such profile' using errcode = 'P0002';
  end if;
  insert into public.donor_grants (user_id, granted_by, note, ends_at)
  values (target, auth.uid(), left(coalesce(note, ''), 500), until);
  perform public.notify_badge(target, 'donor', 'donor');
  return until;
end;
$$;
--> statement-breakpoint

revoke execute on function public.published_story_count(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.notify_badge(uuid, public.notification_type, text) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.check_writing_badge(uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.check_due_writing_badges() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.on_story_badge() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.on_moderation_badge() from public, anon, authenticated;
--> statement-breakpoint

-- Writers keep the tiers they already have without a burst of notifications for them.
update public.profiles p
set badge_tier_notified = public.writing_tier_min(public.published_story_count(p.id));
