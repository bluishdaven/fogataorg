CREATE TYPE "public"."story_version_kind" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" "story_version_kind" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"content" jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_versions_story_idx" ON "story_versions" USING btree ("story_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "story_versions_select_own" ON "story_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.stories s where s.id = "story_versions"."story_id" and s.author_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "story_versions_insert_own" ON "story_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.stories s where s.id = "story_versions"."story_id" and s.author_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "story_versions_update_own" ON "story_versions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.stories s where s.id = "story_versions"."story_id" and s.author_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.stories s where s.id = "story_versions"."story_id" and s.author_id = (select auth.uid())));