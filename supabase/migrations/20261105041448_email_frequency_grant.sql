-- Readers choose their own summary frequency; email_last_sent_at is written only by the email job.
grant update (email_frequency) on public.profiles to authenticated;
--> statement-breakpoint

-- New activity joining an already-emailed group makes it due for the next summary again.
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
  insert into public.notifications as n (user_id, type, story_id, response_id, circle_id, actor_ids, actor_count)
  values (recipient, kind, story, response, circle, array[actor], 1)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  do update set
    actor_ids = case when actor = any(n.actor_ids) then n.actor_ids else (array[actor] || n.actor_ids)[1:20] end,
    actor_count = n.actor_count + case when actor = any(n.actor_ids) then 0 else 1 end,
    circle_id = coalesce(excluded.circle_id, n.circle_id),
    emailed_at = case when actor = any(n.actor_ids) then n.emailed_at else null end;
end;
$$;
--> statement-breakpoint
revoke execute on function public.notify(uuid, public.notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;

--> statement-breakpoint

-- updated_at is "when this group last had new activity" (shown on the notifications page and
-- used to order it). Marking a group read or emailed must not change it, so only bump it when
-- notify() adds an actor.
drop trigger notifications_set_updated_at on public.notifications;
--> statement-breakpoint
create trigger notifications_set_updated_at before update of actor_ids, actor_count on public.notifications
  for each row execute function public.set_updated_at();
