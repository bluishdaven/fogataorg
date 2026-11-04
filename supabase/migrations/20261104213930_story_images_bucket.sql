-- Story images: public to read (covers and inline images appear on public pages),
-- writable only inside the writer's own folder: story-images/<user id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-images',
  'story-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint

create policy "story_images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
--> statement-breakpoint

create policy "story_images_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
--> statement-breakpoint

create policy "story_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
