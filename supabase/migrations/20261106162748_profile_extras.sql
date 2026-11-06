CREATE TYPE "public"."now_focus" AS ENUM('reading', 'watching', 'listening');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pronouns" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "now_focus" "now_focus" DEFAULT 'reading' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "now_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "influences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_pronouns_length" CHECK (char_length("profiles"."pronouns") <= 40);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_now_text_length" CHECK (char_length("profiles"."now_text") <= 120);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_influences_shape" CHECK (jsonb_typeof("profiles"."influences") = 'object' and octet_length("profiles"."influences"::text) <= 4000);