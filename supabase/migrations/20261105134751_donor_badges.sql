CREATE TABLE "donor_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid,
	"note" text DEFAULT '' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "donor_grants_note_length" CHECK (char_length("donor_grants"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "donor_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "donor_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donor_grants_user_idx" ON "donor_grants" USING btree ("user_id","granted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "donor_grants_select_admin" ON "donor_grants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false));