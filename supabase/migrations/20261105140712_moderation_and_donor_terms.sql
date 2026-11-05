CREATE TYPE "public"."moderation_status" AS ENUM('nsfw', 'removed');--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"status" "moderation_status",
	"reason" text DEFAULT '' NOT NULL,
	"moderator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moderation_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "story_moderation" (
	"story_id" uuid PRIMARY KEY NOT NULL,
	"status" "moderation_status" NOT NULL,
	"reason" text NOT NULL,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_moderation_reason_length" CHECK (char_length(btrim("story_moderation"."reason")) between 1 and 300)
);
--> statement-breakpoint
ALTER TABLE "story_moderation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "donor_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_moderator_id_profiles_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_moderation" ADD CONSTRAINT "story_moderation_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_moderation" ADD CONSTRAINT "story_moderation_moderated_by_profiles_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_log_story_idx" ON "moderation_log" USING btree ("story_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "story_moderation_status_idx" ON "story_moderation" USING btree ("status");--> statement-breakpoint
CREATE POLICY "moderation_log_select_admin" ON "moderation_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));--> statement-breakpoint
CREATE POLICY "story_moderation_select_public" ON "story_moderation" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);