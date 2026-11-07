-- Editors may leave the writer a note when they decline (RLS already limits updates to editors).
grant update (decline_note) on public.circle_submissions to authenticated;
--> statement-breakpoint

-- Decisions record who made them and when; a note only survives on a declined submission.
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
  if new.status <> 'declined' then
    new.decline_note := null;
  elsif new.decline_note is not null then
    new.decline_note := nullif(btrim(new.decline_note), '');
  end if;
  return new;
end;
$$;
