CREATE TABLE "reading_positions" (
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"block_id" text,
	"progress" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_positions_user_id_story_id_pk" PRIMARY KEY("user_id","story_id"),
	CONSTRAINT "reading_positions_progress_range" CHECK ("reading_positions"."progress" between 0 and 1),
	CONSTRAINT "reading_positions_block_id_format" CHECK ("reading_positions"."block_id" is null or "reading_positions"."block_id" ~ '^[0-9a-f-]{36}$')
);
--> statement-breakpoint
ALTER TABLE "reading_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reading_positions" ADD CONSTRAINT "reading_positions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_positions" ADD CONSTRAINT "reading_positions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_positions_recent_idx" ON "reading_positions" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "reading_positions_select_own" ON "reading_positions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("reading_positions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reading_positions_insert_own" ON "reading_positions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reading_positions"."user_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "reading_positions"."story_id" and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()));--> statement-breakpoint
CREATE POLICY "reading_positions_update_own" ON "reading_positions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("reading_positions"."user_id" = (select auth.uid())) WITH CHECK ("reading_positions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reading_positions_delete_own" ON "reading_positions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("reading_positions"."user_id" = (select auth.uid()));