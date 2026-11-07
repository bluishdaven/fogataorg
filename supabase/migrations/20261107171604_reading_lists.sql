CREATE TABLE "reading_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_lists_name_length" CHECK (char_length(btrim("reading_lists"."name")) between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "reading_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "bookmarks_user_story_key";--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "list_id" uuid;--> statement-breakpoint
ALTER TABLE "reading_lists" ADD CONSTRAINT "reading_lists_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_lists_user_name_key" ON "reading_lists" USING btree ("user_id",lower(btrim("name")));--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_list_id_reading_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."reading_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_story_list_key" ON "bookmarks" USING btree ("user_id","story_id",coalesce("list_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "bookmarks_list_idx" ON "bookmarks" USING btree ("list_id");--> statement-breakpoint
CREATE POLICY "reading_lists_select_own" ON "reading_lists" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("reading_lists"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reading_lists_insert_own" ON "reading_lists" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("reading_lists"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reading_lists_update_own" ON "reading_lists" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("reading_lists"."user_id" = (select auth.uid())) WITH CHECK ("reading_lists"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "reading_lists_delete_own" ON "reading_lists" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("reading_lists"."user_id" = (select auth.uid()));--> statement-breakpoint
ALTER POLICY "bookmarks_insert_own" ON "bookmarks" TO authenticated WITH CHECK ("bookmarks"."user_id" = (select auth.uid()) and exists (select 1 from public.stories s where s.id = "bookmarks"."story_id") and ("bookmarks"."list_id" is null or exists (select 1 from public.reading_lists l where l.id = "bookmarks"."list_id" and l.user_id = (select auth.uid()))));