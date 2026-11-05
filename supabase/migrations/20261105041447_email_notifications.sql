CREATE TYPE "public"."email_frequency" AS ENUM('off', 'daily', 'weekly');--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_frequency" "email_frequency" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_last_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_unemailed_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null and "notifications"."emailed_at" is null;