CREATE TYPE "public"."circle_role" AS ENUM('owner', 'editor', 'writer');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'submission';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'declined';--> statement-breakpoint
CREATE TABLE "circle_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "circle_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "circle_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circle_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "circles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"accent_color" text DEFAULT '#c2410c' NOT NULL,
	"header_url" text,
	"header_alt" text DEFAULT '' NOT NULL,
	"header_credit" jsonb,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circles_slug_format" CHECK ("circles"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("circles"."slug") between 3 and 40),
	CONSTRAINT "circles_name_length" CHECK (char_length(btrim("circles"."name")) between 2 and 60),
	CONSTRAINT "circles_description_length" CHECK (char_length("circles"."description") <= 280),
	CONSTRAINT "circles_accent_format" CHECK ("circles"."accent_color" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "circles_header_alt_length" CHECK (char_length("circles"."header_alt") <= 300)
);
--> statement-breakpoint
ALTER TABLE "circles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "follows_one_target";--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "followed_circle_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "circle_id" uuid;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_submissions" ADD CONSTRAINT "circle_submissions_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_submissions" ADD CONSTRAINT "circle_submissions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_submissions" ADD CONSTRAINT "circle_submissions_submitted_by_profiles_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_submissions" ADD CONSTRAINT "circle_submissions_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_members_circle_user_key" ON "circle_members" USING btree ("circle_id","user_id");--> statement-breakpoint
CREATE INDEX "circle_members_user_idx" ON "circle_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_submissions_active_story_key" ON "circle_submissions" USING btree ("story_id") WHERE "circle_submissions"."status" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "circle_submissions_circle_idx" ON "circle_submissions" USING btree ("circle_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "circles_slug_key" ON "circles" USING btree (lower("slug"));--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_circle_id_circles_id_fk" FOREIGN KEY ("followed_circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follows_circle_key" ON "follows" USING btree ("follower_id","followed_circle_id") WHERE "follows"."followed_circle_id" is not null;--> statement-breakpoint
CREATE INDEX "follows_followed_circle_idx" ON "follows" USING btree ("followed_circle_id");--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_one_target" CHECK (num_nonnulls("follows"."followed_user_id", "follows"."followed_topic_id", "follows"."followed_circle_id") = 1);--> statement-breakpoint
CREATE POLICY "circle_members_select_public" ON "circle_members" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "circle_members_insert_owner" ON "circle_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("circle_members"."role" <> 'owner' and exists (select 1 from public.circle_members m where m.circle_id = "circle_members"."circle_id" and m.user_id = (select auth.uid()) and m.role = 'owner'));--> statement-breakpoint
CREATE POLICY "circle_members_delete" ON "circle_members" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("circle_members"."role" <> 'owner' and ("circle_members"."user_id" = (select auth.uid()) or exists (select 1 from public.circle_members m where m.circle_id = "circle_members"."circle_id" and m.user_id = (select auth.uid()) and m.role = 'owner')));--> statement-breakpoint
CREATE POLICY "circle_submissions_select_accepted" ON "circle_submissions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("circle_submissions"."status" = 'accepted');--> statement-breakpoint
CREATE POLICY "circle_submissions_select_involved" ON "circle_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("circle_submissions"."submitted_by" = (select auth.uid()) or exists (select 1 from public.circle_members m where m.circle_id = "circle_submissions"."circle_id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')));--> statement-breakpoint
CREATE POLICY "circle_submissions_insert_author" ON "circle_submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("circle_submissions"."submitted_by" = (select auth.uid()) and "circle_submissions"."status" = 'pending' and "circle_submissions"."decided_by" is null and exists (select 1 from public.stories s where s.id = "circle_submissions"."story_id" and s.author_id = (select auth.uid()) and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()));--> statement-breakpoint
CREATE POLICY "circle_submissions_update_editors" ON "circle_submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.circle_members m where m.circle_id = "circle_submissions"."circle_id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor'))) WITH CHECK (exists (select 1 from public.circle_members m where m.circle_id = "circle_submissions"."circle_id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')));--> statement-breakpoint
CREATE POLICY "circle_submissions_delete" ON "circle_submissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("circle_submissions"."submitted_by" = (select auth.uid()) or exists (select 1 from public.circle_members m where m.circle_id = "circle_submissions"."circle_id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')));--> statement-breakpoint
CREATE POLICY "circles_select_public" ON "circles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "circles_insert_own" ON "circles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("circles"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "circles_update_editors" ON "circles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.circle_members m where m.circle_id = "circles"."id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor'))) WITH CHECK (exists (select 1 from public.circle_members m where m.circle_id = "circles"."id" and m.user_id = (select auth.uid()) and m.role in ('owner', 'editor')));