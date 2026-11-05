-- Private circles: join requests (notify editors, decide, clean up) and grants.

create trigger circle_join_requests_set_updated_at before update on public.circle_join_requests
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- A new request tells the circle's owner and editors (grouped per circle while unread).
create or replace function public.on_circle_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editor record;
begin
  for editor in
    select m.user_id from public.circle_members m where m.circle_id = new.circle_id and m.role in ('owner', 'editor')
  loop
    perform public.notify(editor.user_id, 'join_request', new.user_id, null, null, new.circle_id);
  end loop;
  return null;
end;
$$;
--> statement-breakpoint
create trigger circle_join_requests_on_insert after insert on public.circle_join_requests
  for each row execute function public.on_circle_join_request();
--> statement-breakpoint

-- Owners and editors let someone in (as a writer) or turn them down. Returns the circle's slug.
create or replace function public.decide_join_request(request uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.circle_join_requests;
  circle_slug text;
begin
  select * into req from public.circle_join_requests where id = request;
  if req.id is null or not exists (
    select 1 from public.circle_members m
    where m.circle_id = req.circle_id and m.user_id = auth.uid() and m.role in ('owner', 'editor')
  ) then
    raise exception 'Only the circle''s owner and editors can decide' using errcode = '42501';
  end if;
  if req.status <> 'pending' then
    raise exception 'Already decided' using errcode = '55000';
  end if;

  if accept then
    -- Adding the member removes the request (circle_members trigger below).
    insert into public.circle_members (circle_id, user_id, role)
    values (req.circle_id, req.user_id, 'writer')
    on conflict (circle_id, user_id) do nothing;
    delete from public.circle_join_requests where id = req.id;
    perform public.notify(req.user_id, 'join_accepted', auth.uid(), null, null, req.circle_id);
  else
    update public.circle_join_requests
    set status = 'declined', decided_by = auth.uid(), decided_at = now()
    where id = req.id;
  end if;

  select c.slug into circle_slug from public.circles c where c.id = req.circle_id;
  return circle_slug;
end;
$$;
--> statement-breakpoint

-- Whoever becomes a member (also when the owner adds them by username) has nothing left to ask.
create or replace function public.clear_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.circle_join_requests where circle_id = new.circle_id and user_id = new.user_id;
  return null;
end;
$$;
--> statement-breakpoint
create trigger circle_members_clear_join_request after insert on public.circle_members
  for each row execute function public.clear_join_request();
--> statement-breakpoint

revoke execute on function public.on_circle_join_request(), public.clear_join_request() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.decide_join_request(uuid, boolean) from public, anon;
--> statement-breakpoint
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
--> statement-breakpoint

-- Grants ---------------------------------------------------------------------
revoke all on public.circle_join_requests from anon, authenticated;
--> statement-breakpoint
grant select, insert, delete on public.circle_join_requests to authenticated;
--> statement-breakpoint
-- Owners and editors choose whether the circle is private (like its name and colors).
grant update (is_private) on public.circles to authenticated;
