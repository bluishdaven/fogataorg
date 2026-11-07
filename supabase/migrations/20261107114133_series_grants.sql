-- Series: public to read; writers manage their own. The author never changes after creation.
revoke all on public.series from anon, authenticated;
--> statement-breakpoint
grant select on public.series to anon, authenticated;
--> statement-breakpoint
grant insert, delete on public.series to authenticated;
--> statement-breakpoint
grant update (title, description, updated_at) on public.series to authenticated;
--> statement-breakpoint

-- A story can only join a series by the same writer.
create or replace function public.check_story_series()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.series_id is null then
    new.series_position := null;
    return new;
  end if;
  if not exists (select 1 from public.series se where se.id = new.series_id and se.author_id = new.author_id) then
    raise exception 'a story can only join its writer''s own series' using errcode = '42501';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger stories_check_series
  before insert or update of series_id, series_position on public.stories
  for each row execute function public.check_story_series();
--> statement-breakpoint
revoke execute on function public.check_story_series() from public, anon, authenticated;
--> statement-breakpoint
create trigger series_set_updated_at before update on public.series
  for each row execute function public.set_updated_at();
