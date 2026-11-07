CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_of" date NOT NULL,
	"text_en" text NOT NULL,
	"text_es" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_week_of_unique" UNIQUE("week_of"),
	CONSTRAINT "prompts_week_is_monday" CHECK (extract(isodow from "prompts"."week_of") = 1),
	CONSTRAINT "prompts_text_length" CHECK (char_length(btrim("prompts"."text_en")) between 1 and 280 and char_length(btrim("prompts"."text_es")) between 1 and 280)
);
--> statement-breakpoint
ALTER TABLE "prompts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "prompt_id" uuid;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stories_prompt_idx" ON "stories" USING btree ("prompt_id");--> statement-breakpoint
CREATE POLICY "prompts_select_started" ON "prompts" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("prompts"."week_of" <= (now() at time zone 'utc')::date);--> statement-breakpoint
CREATE POLICY "prompts_select_admin" ON "prompts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));--> statement-breakpoint
CREATE POLICY "prompts_insert_admin" ON "prompts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));--> statement-breakpoint
CREATE POLICY "prompts_update_admin" ON "prompts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)) WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));--> statement-breakpoint
CREATE POLICY "prompts_delete_admin" ON "prompts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));