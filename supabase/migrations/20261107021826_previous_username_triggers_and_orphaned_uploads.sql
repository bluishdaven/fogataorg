-- Previous usernames ------------------------------------------------------------
-- Old /@name links redirect to the person's current username (the proxy looks names up here).
-- Anyone may read the list (old names are in old links anyway); only the trigger writes it.
revoke all on public.previous_usernames from anon, authenticated;
--> statement-breakpoint
grant select on public.previous_usernames to anon, authenticated;
--> statement-breakpoint

-- A person's newest five old names stay theirs, so nobody can take one over and catch the traffic
-- from links that are still out there. Raised as a unique violation, like a taken username.
create or replace function public.reserve_previous_usernames()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.previous_usernames pu
    where pu.username = lower(new.username) and pu.profile_id <> new.id
  ) then
    raise exception 'username % was used by someone else recently', new.username
      using errcode = '23505', constraint = 'previous_usernames_pkey';
  end if;
  return new;
end;
$$;
--> statement-breakpoint
create trigger profiles_reserve_previous_usernames
  before insert or update of username on public.profiles
  for each row execute function public.reserve_previous_usernames();
--> statement-breakpoint

create or replace function public.record_previous_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Taking an old name back makes it current again.
  delete from public.previous_usernames where username = lower(new.username);
  insert into public.previous_usernames (username, profile_id)
  values (lower(old.username), new.id)
  on conflict (username) do update set profile_id = excluded.profile_id, changed_at = now();
  -- Keep the newest five; older names are released.
  delete from public.previous_usernames pu
  where pu.profile_id = new.id
    and pu.username not in (
      select keep.username from public.previous_usernames keep
      where keep.profile_id = new.id
      order by keep.changed_at desc, keep.username
      limit 5
    );
  return new;
end;
$$;
--> statement-breakpoint
create trigger profiles_record_previous_username
  after update of username on public.profiles
  for each row
  when (lower(old.username) is distinct from lower(new.username))
  execute function public.record_previous_username();
--> statement-breakpoint
revoke execute on function public.reserve_previous_usernames() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.record_previous_username() from public, anon, authenticated;
--> statement-breakpoint

-- Sign-up skips reserved names too (same function as before, plus the previous_usernames check).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'username';
  meta_locale text := new.raw_user_meta_data ->> 'locale';
  base text;
  candidate text;
  attempts int := 0;
begin
  if requested is not null and requested ~ '^[A-Za-z0-9_]{3,30}$' then
    base := requested;
  else
    base := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9_]', '', 'g'));
    if char_length(base) < 3 then
      base := 'reader' || base;
    end if;
    base := left(base, 25);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate))
     or exists (select 1 from public.previous_usernames pu where pu.username = lower(candidate)) loop
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := 'reader_' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
    candidate := left(base, 25) || '_' || (1000 + floor(random() * 9000))::int;
  end loop;

  insert into public.profiles (id, username, display_name, locale)
  values (
    new.id,
    candidate,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ), 80),
    case when meta_locale in ('en', 'es') then meta_locale::public.locale_code else 'en'::public.locale_code end
  );
  return new;
end;
$$;
--> statement-breakpoint
revoke execute on function public.handle_new_user() from public, anon, authenticated;
--> statement-breakpoint

-- Orphaned uploads ---------------------------------------------------------------
-- Files nothing points to any more: pictures dropped from a story before it was saved, replaced
-- covers and circle headers, deleted stories' pictures, profile photos that never got saved.
-- Only files older than `grace` count, so an upload waiting for its autosave is never listed.
-- The daily cron removes them through the Storage API (deleting storage rows in SQL would leave
-- the files behind). Owner only.
create or replace function public.orphaned_uploads(grace interval default interval '1 day', max_rows integer default 500)
returns table (bucket text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  with referenced_pictures as (
    select m[1] as name
    from public.stories s,
      lateral regexp_matches(
        concat_ws(' ', s.content::text, s.pending_changes::text, s.cover_url, s.thumbnail_url),
        '/storage/v1/object/public/story-images/([0-9a-f-]{36}/[^"?\s\\]+)', 'g'
      ) as m
    where s.deleted_at is null
    union
    select m[1]
    from public.circles c,
      lateral regexp_matches(coalesce(c.header_url, ''), '/storage/v1/object/public/story-images/([0-9a-f-]{36}/[^"?\s\\]+)', 'g') as m
  ),
  referenced_photos as (
    select substring(p.avatar_url from '/storage/v1/object/public/avatars/([0-9a-f-]{36}/[^"?\s]+)') as name
    from public.profiles p
    where p.avatar_url is not null
  )
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where o.created_at < now() - grace
    and (
      (o.bucket_id = 'story-images' and not exists (select 1 from referenced_pictures r where r.name = o.name))
      or (o.bucket_id = 'avatars' and not exists (select 1 from referenced_photos r where r.name = o.name))
    )
  order by o.created_at
  limit max_rows;
$$;
--> statement-breakpoint
revoke execute on function public.orphaned_uploads(interval, integer) from public, anon, authenticated;
