-- Mutes and blocks are private to whoever made them (RLS own-only); only the kind can change.
revoke all on public.user_blocks from anon, authenticated;
--> statement-breakpoint
grant select, insert, update (kind), delete on public.user_blocks to authenticated;
--> statement-breakpoint
create trigger user_blocks_set_updated_at before update on public.user_blocks
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- Whether `blocker` has blocked `target`. Security definer because the blocked person can't (and
-- mustn't) read the blocker's rows.
create or replace function public.has_blocked(blocker uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b where b.blocker_id = blocker and b.blocked_id = target and b.kind = 'block'
  );
$$;
--> statement-breakpoint
revoke execute on function public.has_blocked(uuid, uuid) from public, anon, authenticated;
--> statement-breakpoint

-- Blocked people can't follow you, respond to your stories, reply to your responses, or spark
-- either. Runs before RLS checks; the error is the same one RLS gives (insufficient privilege).
create or replace function public.prevent_blocked_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  owners uuid[];
begin
  if tg_table_name = 'follows' then
    actor := new.follower_id;
    owners := array[new.followed_user_id];
  elsif tg_table_name = 'responses' then
    actor := new.author_id;
    owners := array[(select s.author_id from public.stories s where s.id = new.story_id)];
    if new.parent_id is not null then
      owners := owners || (select r.author_id from public.responses r where r.id = new.parent_id);
    end if;
  elsif tg_table_name = 'sparks' then
    actor := new.user_id;
    owners := array[(select s.author_id from public.stories s where s.id = new.story_id)];
  elsif tg_table_name = 'response_sparks' then
    actor := new.user_id;
    owners := array[(select r.author_id from public.responses r where r.id = new.response_id)];
  end if;
  if exists (
    select 1 from unnest(owners) as o(id) where o.id is not null and public.has_blocked(o.id, actor)
  ) then
    raise exception 'Blocked' using errcode = '42501';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger follows_prevent_blocked before insert on public.follows
  for each row execute function public.prevent_blocked_interaction();
--> statement-breakpoint
create trigger responses_prevent_blocked before insert on public.responses
  for each row execute function public.prevent_blocked_interaction();
--> statement-breakpoint
create trigger sparks_prevent_blocked before insert on public.sparks
  for each row execute function public.prevent_blocked_interaction();
--> statement-breakpoint
create trigger response_sparks_prevent_blocked before insert on public.response_sparks
  for each row execute function public.prevent_blocked_interaction();
--> statement-breakpoint

-- Blocking someone ends follows both ways.
create or replace function public.unfollow_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'block' then
    delete from public.follows f
    where (f.follower_id = new.blocker_id and f.followed_user_id = new.blocked_id)
       or (f.follower_id = new.blocked_id and f.followed_user_id = new.blocker_id);
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger user_blocks_unfollow after insert or update of kind on public.user_blocks
  for each row execute function public.unfollow_on_block();
--> statement-breakpoint
revoke execute on function public.prevent_blocked_interaction(), public.unfollow_on_block() from public, anon, authenticated;
--> statement-breakpoint

-- Muted and blocked people's activity never reaches you. The ON CONFLICT target is unchanged and
-- must stay in step with notifications_unread_group_key and notify_badge().
create or replace function public.notify(
  recipient uuid,
  kind public.notification_type,
  actor uuid,
  story uuid,
  response uuid,
  circle uuid default null
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
  if exists (select 1 from public.user_blocks b where b.blocker_id = recipient and b.blocked_id = actor) then
    return;
  end if;
  insert into public.notifications as n (user_id, type, story_id, response_id, circle_id, actor_ids, actor_count)
  values (recipient, kind, story, response, circle, array[actor], 1)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  do update set
    actor_ids = case when actor = any(n.actor_ids) then n.actor_ids else (array[actor] || n.actor_ids)[1:20] end,
    actor_count = n.actor_count + case when actor = any(n.actor_ids) then 0 else 1 end,
    emailed_at = case when actor = any(n.actor_ids) then n.emailed_at else null end;
end;
$$;
