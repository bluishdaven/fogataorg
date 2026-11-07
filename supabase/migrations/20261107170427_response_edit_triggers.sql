-- Responses can be edited by their authors (the body grant exists since Phase 2). edited_at is
-- stamped here, never by users (no column grant).
create or replace function public.mark_response_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger responses_mark_edited before update of body on public.responses
  for each row execute function public.mark_response_edited();
--> statement-breakpoint

-- People mentioned for the first time in an edit hear about it; people already mentioned don't
-- hear again.
create or replace function public.notify_on_response_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned record;
begin
  if new.deleted_at is not null or new.body is not distinct from old.body then
    return new;
  end if;
  for mentioned in
    select distinct p.id
    from regexp_matches(new.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})', 'g') as m(handle)
    join public.profiles p on lower(p.username) = lower(m.handle[1])
    where not exists (
      select 1
      from regexp_matches(old.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})', 'g') as o(handle)
      where lower(o.handle[1]) = lower(m.handle[1])
    )
    limit 10
  loop
    perform public.notify(mentioned.id, 'mention', new.author_id, new.story_id, new.id);
  end loop;
  return new;
end;
$$;
--> statement-breakpoint
create trigger responses_notify_edit after update of body on public.responses
  for each row execute function public.notify_on_response_edit();
--> statement-breakpoint
revoke execute on function public.mark_response_edited(), public.notify_on_response_edit() from public, anon, authenticated;
