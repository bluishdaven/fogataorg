ALTER TYPE "public"."notification_type" ADD VALUE 'featured';--> statement-breakpoint
CREATE TABLE "prompt_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"featured_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_features_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
ALTER TABLE "prompt_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_features" ADD CONSTRAINT "prompt_features_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_features" ADD CONSTRAINT "prompt_features_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_features" ADD CONSTRAINT "prompt_features_featured_by_profiles_id_fk" FOREIGN KEY ("featured_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_features_prompt_idx" ON "prompt_features" USING btree ("prompt_id","created_at");--> statement-breakpoint
CREATE POLICY "prompt_features_select_public" ON "prompt_features" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "prompt_features_insert_admin" ON "prompt_features" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));--> statement-breakpoint
CREATE POLICY "prompt_features_delete_admin" ON "prompt_features" AS PERMISSIVE FOR DELETE TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));