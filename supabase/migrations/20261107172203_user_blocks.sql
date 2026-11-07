CREATE TYPE "public"."block_kind" AS ENUM('mute', 'block');--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"kind" "block_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_not_self" CHECK ("user_blocks"."blocker_id" <> "user_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "user_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_profiles_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_profiles_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_blocks_pair_key" ON "user_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE POLICY "user_blocks_select_own" ON "user_blocks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_blocks"."blocker_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_blocks_insert_own" ON "user_blocks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_blocks"."blocker_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_blocks_update_own" ON "user_blocks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_blocks"."blocker_id" = (select auth.uid())) WITH CHECK ("user_blocks"."blocker_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "user_blocks_delete_own" ON "user_blocks" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_blocks"."blocker_id" = (select auth.uid()));