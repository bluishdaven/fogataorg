-- Story moderation (admins only) and temporary donor badges (two months per grant).

-- Moderation tables: anyone may read the current state (the reason is shown on the story);
-- only moderate_story() writes. The log is for admins.
revoke all on public.story_moderation, public.moderation_log from anon, authenticated;
grant select on public.story_moderation to anon, authenticated;
grant select on public.moderation_log to authenticated;
--> statement-breakpoint

create or replace function public.moderate_story(
  target uuid,
  new_status public.moderation_status,
  reason text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := left(btrim(coalesce(reason, '')), 300);
begin
  if not public.is_admin() then
    raise exception 'Only admins can moderate stories' using errcode = '42501';
  end if;
  if not exists (select 1 from public.stories s where s.id = target) then
    raise exception 'No such story' using errcode = 'P0002';
  end if;

  if new_status is null then
    delete from public.story_moderation where story_id = target;
  else
    if why = '' then
      raise exception 'A reason is required' using errcode = '22023';
    end if;
    insert into public.story_moderation (story_id, status, reason, moderated_by)
    values (target, new_status, why, auth.uid())
    on conflict (story_id) do update set
      status = excluded.status,
      reason = excluded.reason,
      moderated_by = excluded.moderated_by,
      moderated_at = now();
  end if;

  insert into public.moderation_log (story_id, status, reason, moderator_id)
  values (target, new_status, why, auth.uid());
end;
$$;
--> statement-breakpoint

revoke execute on function public.moderate_story(uuid, public.moderation_status, text) from public, anon;
grant execute on function public.moderate_story(uuid, public.moderation_status, text) to authenticated;
--> statement-breakpoint

-- Donor badges become temporary: existing grants run two months from when they began.
update public.profiles
set donor_until = donor_since + interval '2 months'
where donor_since is not null and donor_until is null;
--> statement-breakpoint
update public.donor_grants
set ends_at = granted_at + interval '2 months'
where ends_at is null;
--> statement-breakpoint

-- Each grant adds two months to whatever time is left (so donating early never loses days).
create or replace function public.grant_donor_badge(target uuid, note text default '')
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can grant donor badges' using errcode = '42501';
  end if;
  update public.profiles
  set donor_since = coalesce(donor_since, now()),
      donor_until = greatest(coalesce(donor_until, now()), now()) + interval '2 months'
  where id = target
  returning donor_until into until;
  if until is null then
    raise exception 'No such profile' using errcode = 'P0002';
  end if;
  insert into public.donor_grants (user_id, granted_by, note, ends_at)
  values (target, auth.uid(), left(coalesce(note, ''), 500), until);
  return until;
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
  update public.profiles set donor_since = null, donor_until = null where id = target;
end;
$$;
--> statement-breakpoint

-- Now also returns when the current badge ends.
drop function if exists public.admin_find_profile(text);
--> statement-breakpoint
create function public.admin_find_profile(query text)
returns table (id uuid, username text, display_name text, donor_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can look up accounts' using errcode = '42501';
  end if;
  return query
    select p.id, p.username, p.display_name, p.donor_until
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.username) = lower(ltrim(btrim(query), '@'))
       or lower(u.email) = lower(btrim(query))
    limit 1;
end;
$$;
--> statement-breakpoint
revoke execute on function public.admin_find_profile(text) from public, anon;
grant execute on function public.admin_find_profile(text) to authenticated;
