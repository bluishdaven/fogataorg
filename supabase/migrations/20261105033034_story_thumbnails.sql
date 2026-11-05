ALTER TABLE "stories" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "thumbnail_alt" text DEFAULT '' NOT NULL;