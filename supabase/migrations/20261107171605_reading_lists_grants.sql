-- Reading lists are private to their reader (RLS own-only); names are all they can change.
revoke all on public.reading_lists from anon, authenticated;
--> statement-breakpoint
grant select, insert, update (name), delete on public.reading_lists to authenticated;
--> statement-breakpoint
create trigger reading_lists_set_updated_at before update on public.reading_lists
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- At most 50 lists per reader.
create or replace function public.limit_reading_lists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('reading_lists:' || new.user_id::text, 0));
  if (select count(*) from public.reading_lists l where l.user_id = new.user_id) >= 50 then
    raise exception 'A reader can have at most 50 reading lists' using errcode = '54000';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger reading_lists_limit before insert on public.reading_lists
  for each row execute function public.limit_reading_lists();
--> statement-breakpoint
revoke execute on function public.limit_reading_lists() from public, anon, authenticated;
--> statement-breakpoint

-- A story can now sit in several of a reader's lists; it still counts as one save.
create or replace function public.story_heat(since interval default interval '14 days')
returns table (story_id uuid, heat double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select a.story_id, sum(a.weight * power(0.5, extract(epoch from (now() - a.at)) / 129600.0)) as heat
  from (
    select sp.story_id, sp.updated_at as at, 2 + least(sp.count, 50) / 25.0 as weight
    from public.sparks sp where sp.updated_at > now() - since
    union all
    select r.story_id, r.created_at, 3
    from public.responses r join public.stories s on s.id = r.story_id
    where r.created_at > now() - since and r.deleted_at is null and r.author_id <> s.author_id
    union all
    select b.story_id, min(b.created_at), 2.5
    from public.bookmarks b where b.created_at > now() - since
    group by b.story_id, b.user_id
    union all
    select hl.story_id, max(hl.created_at), 2
    from public.highlights hl where hl.created_at > now() - since
    group by hl.story_id, hl.user_id
    union all
    select re.story_id, re.updated_at, 1
    from public.read_events re where re.updated_at > now() - since and re.read_ratio >= 0.5
  ) a
  group by a.story_id;
$$;
