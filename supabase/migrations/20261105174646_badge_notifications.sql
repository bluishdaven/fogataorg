ALTER TYPE "public"."notification_type" ADD VALUE 'badge';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'donor';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "badge" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "badge_tier_notified" integer DEFAULT 0 NOT NULL;