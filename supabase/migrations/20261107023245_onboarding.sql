ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "reading_languages" "locale_code"[] DEFAULT '{es,en}'::locale_code[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_reading_languages_size" CHECK (cardinality("profiles"."reading_languages") between 1 and 2);