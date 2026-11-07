-- Embers are private: a reader sees, adds and removes only their own (RLS), never edits them.
revoke all on public.highlights from anon, authenticated;
--> statement-breakpoint
grant select, insert, delete on public.highlights to authenticated;
--> statement-breakpoint

-- Burning now also counts embers (2 each, like a save without the commitment), still one score per
-- story and nothing about who kept what.
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
    select b.story_id, b.created_at, 2.5
    from public.bookmarks b where b.created_at > now() - since
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
