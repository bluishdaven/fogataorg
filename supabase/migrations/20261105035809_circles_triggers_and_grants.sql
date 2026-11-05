-- Circles: updated_at, owner membership, submission workflow, notifications, grants.

create trigger circles_set_updated_at before update on public.circles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger circle_members_set_updated_at before update on public.circle_members
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger circle_submissions_set_updated_at before update on public.circle_submissions
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- The creator becomes the owner member.
create or replace function public.add_circle_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.circle_members (circle_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
--> statement-breakpoint
create trigger circles_add_owner after insert on public.circles
  for each row execute function public.add_circle_owner();
--> statement-breakpoint

-- Decisions record who made them and when.
create or replace function public.stamp_submission_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger circle_submissions_stamp_decision before update on public.circle_submissions
  for each row execute function public.stamp_submission_decision();
--> statement-breakpoint

-- notify() gains an optional circle so notifications can say where things happened.
drop function if exists public.notify(uuid, public.notification_type, uuid, uuid, uuid);
--> statement-breakpoint
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
    circle_id = coalesce(excluded.circle_id, n.circle_id);
end;
$$;
--> statement-breakpoint
revoke execute on function public.notify(uuid, public.notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;
--> statement-breakpoint

-- New submissions: members skip review; everyone else waits for an editor (who gets notified).
create or replace function public.on_circle_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editor record;
begin
  if exists (select 1 from public.circle_members m where m.circle_id = new.circle_id and m.user_id = new.submitted_by) then
    update public.circle_submissions
      set status = 'accepted', decided_by = new.submitted_by, decided_at = now()
      where id = new.id;
    return new;
  end if;
  for editor in
    select m.user_id from public.circle_members m where m.circle_id = new.circle_id and m.role in ('owner', 'editor')
  loop
    perform public.notify(editor.user_id, 'submission', new.submitted_by, new.story_id, null, new.circle_id);
  end loop;
  return new;
end;
$$;
--> statement-breakpoint
create trigger circle_submissions_on_insert after insert on public.circle_submissions
  for each row execute function public.on_circle_submission();
--> statement-breakpoint

create or replace function public.on_circle_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'declined') and new.decided_by is not null then
    perform public.notify(
      new.submitted_by,
      case when new.status = 'accepted' then 'accepted'::public.notification_type else 'declined'::public.notification_type end,
      new.decided_by,
      new.story_id,
      null,
      new.circle_id
    );
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger circle_submissions_on_decision after update on public.circle_submissions
  for each row execute function public.on_circle_decision();
--> statement-breakpoint

revoke execute on function public.add_circle_owner(), public.stamp_submission_decision(),
  public.on_circle_submission(), public.on_circle_decision() from public, anon, authenticated;
--> statement-breakpoint

-- Grants ---------------------------------------------------------------------
revoke all on public.circles, public.circle_members, public.circle_submissions from anon, authenticated;
--> statement-breakpoint
grant select on public.circles, public.circle_members, public.circle_submissions to anon, authenticated;
--> statement-breakpoint
grant insert on public.circles to authenticated;
--> statement-breakpoint
-- Editors may change presentation, never the slug or owner.
grant update (name, description, accent_color, header_url, header_alt, header_credit) on public.circles to authenticated;
--> statement-breakpoint
grant insert, delete on public.circle_members to authenticated;
--> statement-breakpoint
grant insert, delete on public.circle_submissions to authenticated;
--> statement-breakpoint
grant update (status) on public.circle_submissions to authenticated;
