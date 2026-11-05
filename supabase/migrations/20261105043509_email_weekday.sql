-- Each reader's weekly summary day. random() is volatile, so existing rows each get their own day.
ALTER TABLE "profiles" ADD COLUMN "email_weekday" smallint DEFAULT floor(random() * 7)::smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_email_weekday_range" CHECK ("profiles"."email_weekday" between 0 and 6);