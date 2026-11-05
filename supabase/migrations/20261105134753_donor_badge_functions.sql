-- Donor badges: only the owner (accounts with app_metadata.role = 'admin', which only the Supabase
-- dashboard or service key can set) grants or removes them. The badge is profiles.donor_since;
-- donor_grants keeps a private log with notes.
revoke all on public.donor_grants from anon, authenticated;
grant select on public.donor_grants to authenticated;
--> statement-breakpoint

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
--> statement-breakpoint

create or replace function public.grant_donor_badge(target uuid, note text default '')
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  since timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can grant donor badges' using errcode = '42501';
  end if;
  insert into public.donor_grants (user_id, granted_by, note)
  values (target, auth.uid(), left(coalesce(note, ''), 500));
  -- Permanent: a later grant keeps the original date.
  update public.profiles set donor_since = coalesce(donor_since, now()) where id = target
  returning donor_since into since;
  return since;
end;
$$;
--> statement-breakpoint

create or replace function public.remove_donor_badge(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove donor badges' using errcode = '42501';
  end if;
  update public.donor_grants set removed_at = now() where user_id = target and removed_at is null;
  update public.profiles set donor_since = null where id = target;
end;
$$;
--> statement-breakpoint

-- Finds an account by @username or by the email it signs in with (emails live in auth.users).
create or replace function public.admin_find_profile(query text)
returns table (id uuid, username text, display_name text, donor_since timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can look up accounts' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.display_name, p.donor_since
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.username) = lower(ltrim(btrim(query), '@'))
       or lower(u.email) = lower(btrim(query))
    limit 1;
end;
$$;
--> statement-breakpoint

revoke execute on function public.grant_donor_badge(uuid, text) from public, anon;
revoke execute on function public.remove_donor_badge(uuid) from public, anon;
revoke execute on function public.admin_find_profile(text) from public, anon;
grant execute on function public.grant_donor_badge(uuid, text) to authenticated;
grant execute on function public.remove_donor_badge(uuid) to authenticated;
grant execute on function public.admin_find_profile(text) to authenticated;
