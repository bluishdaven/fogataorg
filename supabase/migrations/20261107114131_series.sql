CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_title_length" CHECK (char_length(btrim("series"."title")) between 1 and 120),
	CONSTRAINT "series_slug_format" CHECK ("series"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "series_description_length" CHECK (char_length("series"."description") <= 280)
);
--> statement-breakpoint
ALTER TABLE "series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "series_position" integer;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "series_author_slug_key" ON "series" USING btree ("author_id","slug");--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stories_series_idx" ON "stories" USING btree ("series_id","series_position");--> statement-breakpoint
CREATE POLICY "series_select_public" ON "series" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "series_insert_own" ON "series" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("series"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "series_update_own" ON "series" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("series"."author_id" = (select auth.uid())) WITH CHECK ("series"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "series_delete_own" ON "series" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("series"."author_id" = (select auth.uid()));