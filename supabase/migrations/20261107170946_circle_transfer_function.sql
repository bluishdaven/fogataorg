-- Owners can delete their circle (RLS: owner only). Members, submissions, follows, join requests
-- and notifications cascade; stories stay with their writers. The header picture becomes an
-- orphan for the daily cleanup.
grant delete on public.circles to authenticated;
--> statement-breakpoint

-- Owners hand a circle over to one of its members: the new owner gets the owner role and
-- circles.owner_id, the old owner stays on as an editor, and the new owner is told.
create or replace function public.transfer_circle(circle uuid, new_owner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target record;
begin
  select c.id, c.slug, c.owner_id into target from public.circles c where c.id = circle for update;
  if not found or target.owner_id is distinct from me then
    raise exception 'Only the circle''s owner can hand it over' using errcode = '42501';
  end if;
  if new_owner = me or not exists (
    select 1 from public.circle_members m where m.circle_id = circle and m.user_id = new_owner
  ) then
    raise exception 'The new owner must be another member of the circle' using errcode = '42501';
  end if;
  update public.circle_members set role = 'editor' where circle_id = circle and user_id = me;
  update public.circle_members set role = 'owner' where circle_id = circle and user_id = new_owner;
  update public.circles set owner_id = new_owner where id = circle;
  perform public.notify(new_owner, 'circle_owner', me, null, null, circle);
  return target.slug;
end;
$$;
--> statement-breakpoint
revoke execute on function public.transfer_circle(uuid, uuid) from public, anon;
--> statement-breakpoint
grant execute on function public.transfer_circle(uuid, uuid) to authenticated;
