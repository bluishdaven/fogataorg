-- Version history is the writer's alone (RLS checks they wrote the story). No deletes from the app:
-- the trigger below keeps the newest 50 per story, and deleting a story removes its versions.
revoke all on public.story_versions from anon, authenticated;
--> statement-breakpoint
grant select, insert on public.story_versions to authenticated;
--> statement-breakpoint
grant update (title, subtitle, content, word_count, updated_at) on public.story_versions to authenticated;
--> statement-breakpoint

create or replace function public.prune_story_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.story_versions v
  where v.story_id = new.story_id
    and v.id not in (
      select keep.id from public.story_versions keep
      where keep.story_id = new.story_id
      order by keep.created_at desc, keep.id
      limit 50
    );
  return null;
end;
$$;
--> statement-breakpoint
create trigger story_versions_keep_fifty
  after insert on public.story_versions
  for each row execute function public.prune_story_versions();
--> statement-breakpoint
revoke execute on function public.prune_story_versions() from public, anon, authenticated;
