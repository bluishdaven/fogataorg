-- Fogata never reads tables through Supabase's Data API (PostgREST): pages read through the
-- server, and the browser only talks to Auth, Storage and Realtime. Left open, anyone holding the
-- public anon key (it ships in the site's JavaScript) could download every published story in
-- bulk. This pre-request hook refuses every Data API request except the secret service role.
-- Auth, Storage, Realtime and the app's own database connection don't go through PostgREST.

create or replace function public.block_data_api()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if current_user = 'service_role' then
    return;
  end if;
  raise sqlstate 'PT403' using
    message = 'The Data API is turned off for Fogata',
    detail = 'Read stories at https://fogata.org.';
end;
$$;
--> statement-breakpoint

-- PostgREST calls the hook as the request's role.
revoke execute on function public.block_data_api() from public;
--> statement-breakpoint
grant execute on function public.block_data_api() to anon, authenticated, service_role;
--> statement-breakpoint

alter role authenticator set pgrst.db_pre_request to 'public.block_data_api';
--> statement-breakpoint

notify pgrst, 'reload config';
