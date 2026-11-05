CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'declined');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'join_request';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'join_accepted';--> statement-breakpoint
CREATE TABLE "circle_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_join_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "notifications_unread_group_key";--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_join_requests" ADD CONSTRAINT "circle_join_requests_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_join_requests" ADD CONSTRAINT "circle_join_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_join_requests" ADD CONSTRAINT "circle_join_requests_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_join_requests_circle_user_key" ON "circle_join_requests" USING btree ("circle_id","user_id");--> statement-breakpoint
CREATE INDEX "circle_join_requests_circle_idx" ON "circle_join_requests" USING btree ("circle_id","status","created_at");--> statement-breakpoint
CREATE INDEX "circle_join_requests_user_idx" ON "circle_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_unread_group_key" ON "notifications" USING btree ("user_id","type",coalesce("story_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("response_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("circle_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE POLICY "circle_join_requests_select" ON "circle_join_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("circle_join_requests"."user_id" = (select auth.uid()) or exists (select 1 from public.circle_members m where m.circle_id = "circle_join_requests"."circle_id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')));--> statement-breakpoint
CREATE POLICY "circle_join_requests_insert_own" ON "circle_join_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("circle_join_requests"."user_id" = (select auth.uid()) and "circle_join_requests"."status" = 'pending' and "circle_join_requests"."decided_by" is null and exists (select 1 from public.circles c where c.id = "circle_join_requests"."circle_id" and c.is_private) and not exists (select 1 from public.circle_members m where m.circle_id = "circle_join_requests"."circle_id" and m.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "circle_join_requests_delete_own" ON "circle_join_requests" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("circle_join_requests"."user_id" = (select auth.uid()) and "circle_join_requests"."status" = 'pending');--> statement-breakpoint
ALTER POLICY "circle_submissions_insert_author" ON "circle_submissions" TO authenticated WITH CHECK ("circle_submissions"."submitted_by" = (select auth.uid()) and "circle_submissions"."status" = 'pending' and "circle_submissions"."decided_by" is null and exists (select 1 from public.stories s where s.id = "circle_submissions"."story_id" and s.author_id = (select auth.uid()) and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()) and (not exists (select 1 from public.circles c where c.id = "circle_submissions"."circle_id" and c.is_private) or exists (select 1 from public.circle_members m where m.circle_id = "circle_submissions"."circle_id" and m.user_id = (select auth.uid()))));--> statement-breakpoint

-- Hand-added: notifications_unread_group_key now includes circle_id, and ON CONFLICT must name the
-- index's exact expressions, so notify() and notify_badge() change in this same transaction.
create or replace function public.notify(
  recipient uuid,
  kind public.notification_type,
  actor uuid,
  story uuid,
  response uuid,
  circle uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null or actor is null or recipient = actor then
    return;
  end if;
  insert into public.notifications as n (user_id, type, story_id, response_id, circle_id, actor_ids, actor_count)
  values (recipient, kind, story, response, circle, array[actor], 1)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  do update set
    actor_ids = case when actor = any(n.actor_ids) then n.actor_ids else (array[actor] || n.actor_ids)[1:20] end,
    actor_count = n.actor_count + case when actor = any(n.actor_ids) then 0 else 1 end,
    emailed_at = case when actor = any(n.actor_ids) then n.emailed_at else null end;
end;
$$;
--> statement-breakpoint
create or replace function public.notify_badge(recipient uuid, kind public.notification_type, badge_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if recipient is null then
    return;
  end if;
  insert into public.notifications as n (user_id, type, badge, actor_ids, actor_count)
  values (recipient, kind, badge_key, '{}', 0)
  on conflict (
    user_id,
    type,
    coalesce(story_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(circle_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where read_at is null
  -- Still unread: show the newest badge, dated now, and include it in the next summary.
  do update set badge = excluded.badge, updated_at = now(), emailed_at = null;
end;
$$;
