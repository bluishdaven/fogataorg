-- Reading positions are the reader's alone (RLS): see, save, update and clear their own.
revoke all on public.reading_positions from anon, authenticated;
--> statement-breakpoint
grant select, insert, delete on public.reading_positions to authenticated;
--> statement-breakpoint
grant update (block_id, progress, updated_at) on public.reading_positions to authenticated;
