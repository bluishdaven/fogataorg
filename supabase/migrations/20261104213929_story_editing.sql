ALTER TABLE "stories" DROP CONSTRAINT "stories_title_length";--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "seo_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "seo_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "pending_changes" jsonb;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_seo_lengths" CHECK (char_length("stories"."seo_title") <= 70 and char_length("stories"."seo_description") <= 160);--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_title_length" CHECK (char_length("stories"."title") <= 200 and ("stories"."status" = 'draft' or char_length(btrim("stories"."title")) >= 1));