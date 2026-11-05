-- Summaries are weekly only (or off). Existing daily readers move to weekly; nothing is deleted.
ALTER TABLE "profiles" ALTER COLUMN "email_frequency" SET DATA TYPE text;--> statement-breakpoint
UPDATE "profiles" SET "email_frequency" = 'weekly' WHERE "email_frequency" = 'daily';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "email_frequency" SET DEFAULT 'weekly'::text;--> statement-breakpoint
DROP TYPE "public"."email_frequency";--> statement-breakpoint
CREATE TYPE "public"."email_frequency" AS ENUM('off', 'weekly');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "email_frequency" SET DEFAULT 'weekly'::"public"."email_frequency";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "email_frequency" SET DATA TYPE "public"."email_frequency" USING "email_frequency"::"public"."email_frequency";