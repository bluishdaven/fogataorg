CREATE TYPE "public"."locale_code" AS ENUM('en', 'es');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'scheduled', 'published', 'unlisted');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locale" "locale_code" DEFAULT 'en' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_format" CHECK ("profiles"."username" ~ '^[A-Za-z0-9_]{3,30}$'),
	CONSTRAINT "profiles_display_name_length" CHECK (char_length("profiles"."display_name") <= 80),
	CONSTRAINT "profiles_bio_length" CHECK (char_length("profiles"."bio") <= 280)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"content" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"language" "locale_code" NOT NULL,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"reading_time" integer DEFAULT 1 NOT NULL,
	"cover_url" text,
	"canonical_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "stories_title_length" CHECK (char_length("stories"."title") between 1 and 200),
	CONSTRAINT "stories_subtitle_length" CHECK (char_length("stories"."subtitle") <= 280),
	CONSTRAINT "stories_slug_format" CHECK ("stories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "stories_reading_time_positive" CHECK ("stories"."reading_time" >= 1),
	CONSTRAINT "stories_live_has_published_at" CHECK ("stories"."status" = 'draft' or "stories"."published_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "stories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "story_topics" (
	"story_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_topics_story_id_topic_id_pk" PRIMARY KEY("story_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "story_topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug"),
	CONSTRAINT "topics_slug_format" CHECK ("topics"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_topics" ADD CONSTRAINT "story_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_key" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "stories_author_slug_key" ON "stories" USING btree ("author_id","slug");--> statement-breakpoint
CREATE INDEX "stories_feed_idx" ON "stories" USING btree ("published_at" DESC NULLS LAST) WHERE "stories"."status" = 'published' and "stories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stories_author_idx" ON "stories" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "story_topics_topic_idx" ON "story_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE POLICY "profiles_select_public" ON "profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "stories_select_live" ON "stories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("stories"."deleted_at" is null and "stories"."status" in ('published', 'unlisted') and "stories"."published_at" <= now());--> statement-breakpoint
CREATE POLICY "stories_select_own" ON "stories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("stories"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "stories_insert_own" ON "stories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("stories"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "stories_update_own" ON "stories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("stories"."author_id" = (select auth.uid())) WITH CHECK ("stories"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "story_topics_select_visible" ON "story_topics" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.stories s where s.id = "story_topics"."story_id"));--> statement-breakpoint
CREATE POLICY "story_topics_insert_own" ON "story_topics" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.stories s where s.id = "story_topics"."story_id" and s.author_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "story_topics_delete_own" ON "story_topics" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.stories s where s.id = "story_topics"."story_id" and s.author_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "topics_select_public" ON "topics" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);