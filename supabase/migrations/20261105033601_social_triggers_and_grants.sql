-- Phase 2: updated_at triggers, grants, reply rules, pinning, grouped notifications, realtime.

create trigger follows_set_updated_at before update on public.follows
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger sparks_set_updated_at before update on public.sparks
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger bookmarks_set_updated_at before update on public.bookmarks
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger responses_set_updated_at before update on public.responses
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger response_sparks_set_updated_at before update on public.response_sparks
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger notifications_set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- Grants ---------------------------------------------------------------------
revoke all on public.follows, public.sparks, public.bookmarks, public.responses,
  public.response_sparks, public.notifications from anon, authenticated;
--> statement-breakpoint
grant select on public.follows, public.sparks, public.responses, public.response_sparks to anon, authenticated;
--> statement-breakpoint
grant insert, delete on public.follows to authenticated;
--> statement-breakpoint
grant insert, update (count), delete on public.sparks to authenticated;
--> statement-breakpoint
grant select, insert, delete on public.bookmarks to authenticated;
--> statement-breakpoint
-- Writers can't set pinned_at or move a response; pinning goes through set_response_pinned().
grant insert (story_id, author_id, parent_id, block_id, body) on public.responses to authenticated;
--> statement-breakpoint
grant update (body, deleted_at) on public.responses to authenticated;
--> statement-breakpoint
grant insert, delete on public.response_sparks to authenticated;
--> statement-breakpoint
grant select, update (read_at), delete on public.notifications to authenticated;
--> statement-breakpoint

-- Replies: one level deep, same story, parent not deleted ------------------------
create or replace function public.validate_response_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent record;
begin
  if new.parent_id is null then
    return new;
  end if;
  select r.story_id, r.parent_id, r.deleted_at into parent from public.responses r where r.id = new.parent_id;
  if parent is null or parent.deleted_at is not null then
    raise exception 'Parent response not found' using errcode = 'foreign_key_violation';
  end if;
  if parent.story_id <> new.story_id then
    raise exception 'Reply must be on the same story' using errcode = 'check_violation';
  end if;
  if parent.parent_id is not null then
    raise exception 'Replies can only be one level deep' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger responses_validate_parent before insert on public.responses
  for each row execute function public.validate_response_parent();
--> statement-breakpoint

-- Pinning: only the story's writer, only top-level responses -----------------------
create or replace function public.set_response_pinned(target uuid, pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.responses r
    join public.stories s on s.id = r.story_id
    where r.id = target and r.parent_id is null and r.deleted_at is null and s.author_id = (select auth.uid())
  ) then
    raise exception 'Only the writer can pin responses' using errcode = 'insufficient_privilege';
  end if;
  update public.responses set pinned_at = case when pinned then now() else null end where id = target;
end;
$$;
--> statement-breakpoint
revoke execute on function public.set_response_pinned(uuid, boolean) from public, anon;
--> statement-breakpoint
grant execute on function public.set_response_pinned(uuid, boolean) to authenticated;
--> statement-breakpoint

-- Grouped notifications -----------------------------------------------------------
-- One unread row per (recipient, type, story, response); new actors join the group.
create or replace function public.notify(
  recipient uuid,
  kind public.notification_type,
  actor uuid,
  story uuid,
  response uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null or actor is null or recipient = actor then
    return;
  end if;
  insert into public.notifications as n (user_id, type, story_id, response_id, actor_ids, actor_count)
  values (recipient, kind, story, response, array[actor], 1)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  do update set
    actor_ids = case when actor = any(n.actor_ids) then n.actor_ids else (array[actor] || n.actor_ids)[1:20] end,
    actor_count = n.actor_count + case when actor = any(n.actor_ids) then 0 else 1 end;
end;
$$;
--> statement-breakpoint
revoke execute on function public.notify(uuid, public.notification_type, uuid, uuid, uuid) from public, anon, authenticated;
--> statement-breakpoint

create or replace function public.notify_on_spark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify((select s.author_id from public.stories s where s.id = new.story_id), 'spark', new.user_id, new.story_id, null);
  return new;
end;
$$;
--> statement-breakpoint
create trigger sparks_notify after insert on public.sparks
  for each row execute function public.notify_on_spark();
--> statement-breakpoint

create or replace function public.notify_on_response_spark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select r.author_id, r.story_id into target from public.responses r where r.id = new.response_id;
  perform public.notify(target.author_id, 'spark', new.user_id, target.story_id, new.response_id);
  return new;
end;
$$;
--> statement-breakpoint
create trigger response_sparks_notify after insert on public.response_sparks
  for each row execute function public.notify_on_response_spark();
--> statement-breakpoint

create or replace function public.notify_on_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned record;
begin
  if new.parent_id is null then
    -- Grouped per story: "5 people responded to your story".
    perform public.notify((select s.author_id from public.stories s where s.id = new.story_id), 'response', new.author_id, new.story_id, null);
  else
    -- Grouped per response: "3 people replied to your response".
    perform public.notify((select r.author_id from public.responses r where r.id = new.parent_id), 'reply', new.author_id, new.story_id, new.parent_id);
  end if;

  for mentioned in
    select distinct p.id
    from regexp_matches(new.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})', 'g') as m(handle)
    join public.profiles p on lower(p.username) = lower(m.handle[1])
    limit 10
  loop
    perform public.notify(mentioned.id, 'mention', new.author_id, new.story_id, new.id);
  end loop;
  return new;
end;
$$;
--> statement-breakpoint
create trigger responses_notify after insert on public.responses
  for each row execute function public.notify_on_response();
--> statement-breakpoint

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.followed_user_id is not null then
    perform public.notify(new.followed_user_id, 'follow', new.follower_id, null, null);
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_on_follow();
--> statement-breakpoint

revoke execute on function public.notify_on_spark(), public.notify_on_response_spark(),
  public.notify_on_response(), public.notify_on_follow(), public.validate_response_parent()
  from public, anon, authenticated;
--> statement-breakpoint

-- Live notification badge (RLS limits each subscriber to their own rows).
alter publication supabase_realtime add table public.notifications;
