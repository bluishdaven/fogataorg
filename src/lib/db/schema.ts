import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import type { TiptapDoc } from "@/lib/domain/content";
import type { PendingChanges } from "@/lib/domain/stories";
import type { ImageCredit } from "@/lib/domain/unsplash";

/**
 * Source of truth for tables and RLS policies. `npm run db:generate` turns
 * changes into SQL under supabase/migrations; the Supabase CLI applies them.
 * Triggers, functions and column grants live in the hand-written migration
 * next to the generated one (see CLAUDE.md → Database).
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const everyone = [anonRole, authenticatedRole];

export const localeCode = pgEnum("locale_code", ["en", "es"]);
export const storyStatus = pgEnum("story_status", ["draft", "scheduled", "published", "unlisted"]);

export type ProfileLink = { label: string; url: string };

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull().default(""),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    links: jsonb("links").$type<ProfileLink[]>().notNull().default(sql`'[]'::jsonb`),
    locale: localeCode("locale").notNull().default("en"),
    isVerified: boolean("is_verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_username_lower_key").on(sql`lower(${t.username})`),
    check("profiles_username_format", sql`${t.username} ~ '^[A-Za-z0-9_]{3,30}$'`),
    check("profiles_display_name_length", sql`char_length(${t.displayName}) <= 80`),
    check("profiles_bio_length", sql`char_length(${t.bio}) <= 280`),
    pgPolicy("profiles_select_public", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameEs: text("name_es").notNull(),
    ...timestamps,
  },
  (t) => [
    check("topics_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    pgPolicy("topics_select_public", { for: "select", to: everyone, using: sql`true` }),
  ],
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    slug: text("slug").notNull(),
    content: jsonb("content")
      .$type<TiptapDoc>()
      .notNull()
      .default(sql`'{"type":"doc","content":[]}'::jsonb`),
    contentText: text("content_text").notNull().default(""),
    language: localeCode("language").notNull(),
    status: storyStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    readingTime: integer("reading_time").notNull().default(1),
    coverUrl: text("cover_url"),
    // Alt text is required whenever there's a cover (enforced in the publish flow).
    coverAlt: text("cover_alt").notNull().default(""),
    // Who to credit for the cover (e.g. an Unsplash photographer). Null for the writer's own uploads.
    coverCredit: jsonb("cover_credit").$type<ImageCredit>(),
    // List-view thumbnail, set on publish: the cover, else the first image in the story.
    thumbnailUrl: text("thumbnail_url"),
    thumbnailAlt: text("thumbnail_alt").notNull().default(""),
    canonicalUrl: text("canonical_url"),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    // Edits to a published story wait here until the writer publishes them.
    pendingChanges: jsonb("pending_changes").$type<PendingChanges>(),
    // Bumped on every save; saves must name the revision they started from.
    revision: integer("revision").notNull().default(0),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("stories_author_slug_key").on(t.authorId, t.slug),
    index("stories_feed_idx")
      .on(t.publishedAt.desc())
      .where(sql`${t.status} = 'published' and ${t.deletedAt} is null`),
    index("stories_author_idx").on(t.authorId),
    // Drafts may be untitled; anything live needs a title.
    check(
      "stories_title_length",
      sql`char_length(${t.title}) <= 200 and (${t.status} = 'draft' or char_length(btrim(${t.title})) >= 1)`,
    ),
    check("stories_seo_lengths", sql`char_length(${t.seoTitle}) <= 70 and char_length(${t.seoDescription}) <= 160`),
    check("stories_subtitle_length", sql`char_length(${t.subtitle}) <= 280`),
    check("stories_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("stories_reading_time_positive", sql`${t.readingTime} >= 1`),
    check("stories_cover_alt_length", sql`char_length(${t.coverAlt}) <= 300`),
    check(
      "stories_live_has_published_at",
      sql`${t.status} = 'draft' or ${t.publishedAt} is not null`,
    ),
    // Anyone can read live stories. Unlisted ones are readable by link but never listed.
    pgPolicy("stories_select_live", {
      for: "select",
      to: everyone,
      using: sql`${t.deletedAt} is null and ${t.status} in ('published', 'unlisted') and ${t.publishedAt} <= now()`,
    }),
    // Authors always see their own stories, including drafts and soft-deleted ones.
    pgPolicy("stories_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.authorId} = ${authUid}`,
    }),
    pgPolicy("stories_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.authorId} = ${authUid}`,
    }),
    // No delete policy: authors soft-delete by setting deleted_at.
    pgPolicy("stories_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.authorId} = ${authUid}`,
      withCheck: sql`${t.authorId} = ${authUid}`,
    }),
  ],
);

export const storyTopics = pgTable(
  "story_topics",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.topicId] }),
    index("story_topics_topic_idx").on(t.topicId),
    // Visible when the story is visible to the caller (stories RLS applies inside the subquery).
    pgPolicy("story_topics_select_visible", {
      for: "select",
      to: everyone,
      using: sql`exists (select 1 from public.stories s where s.id = ${t.storyId})`,
    }),
    pgPolicy("story_topics_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`exists (select 1 from public.stories s where s.id = ${t.storyId} and s.author_id = ${authUid})`,
    }),
    pgPolicy("story_topics_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.stories s where s.id = ${t.storyId} and s.author_id = ${authUid})`,
    }),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
