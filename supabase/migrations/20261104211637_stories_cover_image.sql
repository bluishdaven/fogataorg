ALTER TABLE "stories" ADD COLUMN "cover_alt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "cover_credit" jsonb;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_cover_alt_length" CHECK (char_length("stories"."cover_alt") <= 300);