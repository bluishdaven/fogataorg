-- Taking sparks back also takes back the notification they caused, while it's still unread:
-- unnotify() removes the actor from the matching unread group (the same keys as
-- notifications_unread_group_key and notify()) and deletes the group when nobody is left.
create or replace function public.unnotify(
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
declare
  zero constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  if recipient is null or actor is null then
    return;
  end if;
  update public.notifications n
  set actor_ids = array_remove(n.actor_ids, actor),
      actor_count = greatest(n.actor_count - 1, 0)
  where n.user_id = recipient
    and n.type = kind
    and n.read_at is null
    and coalesce(n.story_id, zero) = coalesce(story, zero)
    and coalesce(n.response_id, zero) = coalesce(response, zero)
    and coalesce(n.circle_id, zero) = coalesce(circle, zero)
    and actor = any(n.actor_ids);
  delete from public.notifications n
  where n.user_id = recipient
    and n.type = kind
    and n.read_at is null
    and n.actor_count = 0
    and coalesce(n.story_id, zero) = coalesce(story, zero)
    and coalesce(n.response_id, zero) = coalesce(response, zero)
    and coalesce(n.circle_id, zero) = coalesce(circle, zero);
end;
$$;
--> statement-breakpoint
revoke execute on function public.unnotify(uuid, public.notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;
--> statement-breakpoint

-- Someone leaving a group isn't new activity: only bump updated_at when the group grows or the
-- same people act again (as before).
drop trigger notifications_set_updated_at on public.notifications;
--> statement-breakpoint
create trigger notifications_set_updated_at before update of actor_ids, actor_count on public.notifications
  for each row when (new.actor_count >= old.actor_count) execute function public.set_updated_at();
--> statement-breakpoint

create or replace function public.unnotify_on_spark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.unnotify((select s.author_id from public.stories s where s.id = old.story_id), 'spark', old.user_id, old.story_id, null);
  return old;
end;
$$;
--> statement-breakpoint
create trigger sparks_unnotify after delete on public.sparks
  for each row execute function public.unnotify_on_spark();
--> statement-breakpoint

create or replace function public.unnotify_on_response_spark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
begin
  select r.author_id, r.story_id into target from public.responses r where r.id = old.response_id;
  if found then
    perform public.unnotify(target.author_id, 'spark', old.user_id, target.story_id, old.response_id);
  end if;
  return old;
end;
$$;
--> statement-breakpoint
create trigger response_sparks_unnotify after delete on public.response_sparks
  for each row execute function public.unnotify_on_response_spark();
--> statement-breakpoint
revoke execute on function public.unnotify_on_spark(), public.unnotify_on_response_spark() from public, anon, authenticated;
