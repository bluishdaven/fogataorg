-- Hand-written companion to the generated init migration:
-- updated_at triggers, profile creation on sign-up, topic limit, and table/column grants.

-- updated_at ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
--> statement-breakpoint

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger topics_set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger stories_set_updated_at before update on public.stories
  for each row execute function public.set_updated_at();
--> statement-breakpoint
create trigger story_topics_set_updated_at before update on public.story_topics
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- Profile on sign-up ---------------------------------------------------------
-- Username: requested one (user_metadata.username) if valid, else derived from the
-- email local part, with a numeric suffix when taken. Users can change it later.
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
  while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) loop
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

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
--> statement-breakpoint

-- Max 5 topics per story ---------------------------------------------------
create or replace function public.enforce_story_topic_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize concurrent inserts for the same story so the count can't race.
  perform 1 from public.stories s where s.id = new.story_id for update;
  if (select count(*) from public.story_topics st where st.story_id = new.story_id) >= 5 then
    raise exception 'A story can have at most 5 topics' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger story_topics_limit before insert on public.story_topics
  for each row execute function public.enforce_story_topic_limit();
--> statement-breakpoint

revoke execute on function public.handle_new_user() from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.enforce_story_topic_limit() from public, anon, authenticated;
--> statement-breakpoint

-- Grants -------------------------------------------------------------------
-- RLS decides which rows; grants decide which operations and columns.
-- Supabase grants everything on new public tables by default, so narrow it down.
revoke all on public.profiles, public.topics, public.stories, public.story_topics from anon, authenticated;
--> statement-breakpoint

grant select on public.profiles, public.topics, public.stories, public.story_topics to anon, authenticated;
--> statement-breakpoint

-- Profiles are created by the sign-up trigger. Users may edit only these columns
-- (never id, is_verified or timestamps).
grant update (username, display_name, bio, avatar_url, links, locale) on public.profiles to authenticated;
--> statement-breakpoint

grant insert, update on public.stories to authenticated;
--> statement-breakpoint

grant insert, delete on public.story_topics to authenticated;
