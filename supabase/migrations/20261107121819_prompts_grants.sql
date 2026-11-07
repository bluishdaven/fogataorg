-- Weekly sparks: anyone reads started ones; admins (RLS) write them.
revoke all on public.prompts from anon, authenticated;
--> statement-breakpoint
grant select on public.prompts to anon, authenticated;
--> statement-breakpoint
grant insert, delete on public.prompts to authenticated;
--> statement-breakpoint
grant update (week_of, text_en, text_es, updated_at) on public.prompts to authenticated;
--> statement-breakpoint
create trigger prompts_set_updated_at before update on public.prompts
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- A story can answer a spark that has started, not one written ahead for a later week.
create or replace function public.check_story_prompt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.prompt_id is not null and new.prompt_id is distinct from old.prompt_id and not exists (
    select 1 from public.prompts p where p.id = new.prompt_id and p.week_of <= (now() at time zone 'utc')::date
  ) then
    raise exception 'that weekly spark has not started yet' using errcode = '42501';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger stories_check_prompt
  before update of prompt_id on public.stories
  for each row execute function public.check_story_prompt();
--> statement-breakpoint
create or replace function public.check_new_story_prompt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.prompt_id is not null and not exists (
    select 1 from public.prompts p where p.id = new.prompt_id and p.week_of <= (now() at time zone 'utc')::date
  ) then
    raise exception 'that weekly spark has not started yet' using errcode = '42501';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger stories_check_new_prompt
  before insert on public.stories
  for each row execute function public.check_new_story_prompt();
--> statement-breakpoint
revoke execute on function public.check_story_prompt() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.check_new_story_prompt() from public, anon, authenticated;
