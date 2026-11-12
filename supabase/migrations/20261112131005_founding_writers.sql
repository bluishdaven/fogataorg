ALTER TYPE "public"."notification_type" ADD VALUE 'founding';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "founding_number" smallint;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_founding_number_unique" UNIQUE("founding_number");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_founding_number_range" CHECK ("profiles"."founding_number" between 1 and 100);