-- Drizzle lists every column in INSERT (DEFAULT for unset ones), and Postgres checks
-- column privileges even for DEFAULT. Grant table-level insert; the insert policy
-- forbids pinned_at/deleted_at instead.
revoke insert on public.responses from authenticated;
--> statement-breakpoint
grant insert on public.responses to authenticated;
