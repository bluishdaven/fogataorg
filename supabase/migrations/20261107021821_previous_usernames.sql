CREATE TABLE "previous_usernames" (
	"username" text PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "previous_usernames_lowercase" CHECK ("previous_usernames"."username" = lower("previous_usernames"."username"))
);
--> statement-breakpoint
ALTER TABLE "previous_usernames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "previous_usernames" ADD CONSTRAINT "previous_usernames_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "previous_usernames_profile_idx" ON "previous_usernames" USING btree ("profile_id","changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "previous_usernames_select_public" ON "previous_usernames" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);