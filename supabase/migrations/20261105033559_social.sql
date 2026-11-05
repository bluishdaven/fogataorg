CREATE TYPE "public"."notification_type" AS ENUM('spark', 'response', 'reply', 'mention', 'follow');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"followed_user_id" uuid,
	"followed_topic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_one_target" CHECK (num_nonnulls("follows"."followed_user_id", "follows"."followed_topic_id") = 1),
	CONSTRAINT "follows_not_self" CHECK ("follows"."followed_user_id" is distinct from "follows"."follower_id")
);
--> statement-breakpoint
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"story_id" uuid,
	"response_id" uuid,
	"actor_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"actor_count" integer DEFAULT 1 NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "response_sparks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "response_sparks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"block_id" text,
	"body" text NOT NULL,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "responses_body_length" CHECK (char_length(btrim("responses"."body")) between 1 and 4000),
	CONSTRAINT "responses_block_id_format" CHECK ("responses"."block_id" is null or "responses"."block_id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);
--> statement-breakpoint
ALTER TABLE "responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sparks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sparks_count_range" CHECK ("sparks"."count" between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "sparks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_profiles_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_user_id_profiles_id_fk" FOREIGN KEY ("followed_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_topic_id_topics_id_fk" FOREIGN KEY ("followed_topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_sparks" ADD CONSTRAINT "response_sparks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_sparks" ADD CONSTRAINT "response_sparks_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_parent_id_responses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sparks" ADD CONSTRAINT "sparks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sparks" ADD CONSTRAINT "sparks_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_story_key" ON "bookmarks" USING btree ("user_id","story_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "follows_user_key" ON "follows" USING btree ("follower_id","followed_user_id") WHERE "follows"."followed_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "follows_topic_key" ON "follows" USING btree ("follower_id","followed_topic_id") WHERE "follows"."followed_topic_id" is not null;--> statement-breakpoint
CREATE INDEX "follows_followed_user_idx" ON "follows" USING btree ("followed_user_id");--> statement-breakpoint
CREATE INDEX "follows_followed_topic_idx" ON "follows" USING btree ("followed_topic_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_unread_group_key" ON "notifications" USING btree ("user_id","type",coalesce("story_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("response_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "response_sparks_user_response_key" ON "response_sparks" USING btree ("user_id","response_id");--> statement-breakpoint
CREATE INDEX "response_sparks_response_idx" ON "response_sparks" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "responses_story_idx" ON "responses" USING btree ("story_id","created_at");--> statement-breakpoint
CREATE INDEX "responses_parent_idx" ON "responses" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sparks_user_story_key" ON "sparks" USING btree ("user_id","story_id");--> statement-breakpoint
CREATE INDEX "sparks_story_idx" ON "sparks" USING btree ("story_id");--> statement-breakpoint
CREATE POLICY "bookmarks_select_own" ON "bookmarks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bookmarks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "bookmarks_insert_own" ON "bookmarks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("bookmarks"."user_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "bookmarks"."story_id"));--> statement-breakpoint
CREATE POLICY "bookmarks_delete_own" ON "bookmarks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("bookmarks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "follows_select_public" ON "follows" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "follows_insert_own" ON "follows" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("follows"."follower_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "follows_delete_own" ON "follows" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("follows"."follower_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_select_own" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_update_own" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notifications"."user_id" = (select auth.uid())) WITH CHECK ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_delete_own" ON "notifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("notifications"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "response_sparks_select_public" ON "response_sparks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "response_sparks_insert_own" ON "response_sparks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("response_sparks"."user_id" = (select auth.uid()) and exists (select 1 from public.responses r where r.id = "response_sparks"."response_id" and r.author_id <> (select auth.uid())));--> statement-breakpoint
CREATE POLICY "response_sparks_delete_own" ON "response_sparks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("response_sparks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "responses_select_visible" ON "responses" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("responses"."deleted_at" is null and exists (select 1 from public.stories s where s.id = "responses"."story_id"));--> statement-breakpoint
CREATE POLICY "responses_insert_own" ON "responses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("responses"."author_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "responses"."story_id" and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()));--> statement-breakpoint
CREATE POLICY "responses_update_own" ON "responses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("responses"."author_id" = (select auth.uid()) and "responses"."deleted_at" is null) WITH CHECK ("responses"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "sparks_select_public" ON "sparks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sparks_insert_own" ON "sparks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("sparks"."user_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "sparks"."story_id" and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()) and not exists (select 1 from public.stories s where s.id = "sparks"."story_id" and s.author_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "sparks_update_own" ON "sparks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("sparks"."user_id" = (select auth.uid())) WITH CHECK ("sparks"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "sparks_delete_own" ON "sparks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("sparks"."user_id" = (select auth.uid()));