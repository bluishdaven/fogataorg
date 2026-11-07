-- People can delete their own account. Removing the auth user cascades to the profile and from there
-- to everything tied to it (stories, responses, sparks, follows, saved stories, circles they own,
-- notifications). Uploaded files are removed by the app first, through the Storage API.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in to delete your account' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;
--> statement-breakpoint
revoke execute on function public.delete_own_account() from public, anon;
--> statement-breakpoint
grant execute on function public.delete_own_account() to authenticated;
