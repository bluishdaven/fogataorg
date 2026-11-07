CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"quote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "highlights_block_id_format" CHECK ("highlights"."block_id" ~ '^[0-9a-f-]{36}$'),
	CONSTRAINT "highlights_offsets" CHECK ("highlights"."start_offset" >= 0 and "highlights"."end_offset" > "highlights"."start_offset"),
	CONSTRAINT "highlights_quote_length" CHECK (char_length("highlights"."quote") between 1 and 600)
);
--> statement-breakpoint
ALTER TABLE "highlights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "highlights_user_passage_key" ON "highlights" USING btree ("user_id","story_id","block_id","start_offset","end_offset");--> statement-breakpoint
CREATE INDEX "highlights_user_created_idx" ON "highlights" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "highlights_story_idx" ON "highlights" USING btree ("story_id","created_at");--> statement-breakpoint
CREATE POLICY "highlights_select_own" ON "highlights" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("highlights"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "highlights_insert_own" ON "highlights" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("highlights"."user_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "highlights"."story_id" and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()));--> statement-breakpoint
CREATE POLICY "highlights_delete_own" ON "highlights" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("highlights"."user_id" = (select auth.uid()));