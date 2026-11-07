import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";
import type { TiptapDoc } from "@/lib/domain/content";
import type { Influences } from "@/lib/domain/profile";
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
export const emailFrequency = pgEnum("email_frequency", ["off", "weekly"]);
export const storyStatus = pgEnum("story_status", ["draft", "scheduled", "published", "unlisted"]);

export type ProfileLink = { label: string; url: string };

/** What a person's "Now" line is about. */
export const nowFocus = pgEnum("now_focus", ["reading", "watching", "listening"]);

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
    // Optional, free text ("she/her", "they/them", "él/elle"…).
    pronouns: text("pronouns").notNull().default(""),
    // "Now reading / watching / listening to …"; hidden while now_text is empty.
    nowFocus: nowFocus("now_focus").notNull().default("reading"),
    nowText: text("now_text").notNull().default(""),
    influences: jsonb("influences").$type<Influences>().notNull().default(sql`'{}'::jsonb`),
    locale: localeCode("locale").notNull().default("en"),
    isVerified: boolean("is_verified").notNull().default(false),
    // Activity summary emails: one a week at most, on a weekday fixed per reader; one click turns them off.
    emailFrequency: emailFrequency("email_frequency").notNull().default("weekly"),
    emailLastSentAt: timestamp("email_last_sent_at", { withTimezone: true }),
    // Weekday (0 = Sunday, UTC) the summary goes out, random per reader so sends spread over the week.
    emailWeekday: smallint("email_weekday").notNull().default(sql`floor(random() * 7)::smallint`),
    // Donor badge (grant_donor_badge, owner only): first grant, and when the current two months end.
    donorSince: timestamp("donor_since", { withTimezone: true }),
    donorUntil: timestamp("donor_until", { withTimezone: true }),
    // Highest writing tier (its minimum story count) the writer was notified about, so a tier is
    // announced once even if stories are unpublished and published again. Set by trigger only.
    badgeTierNotified: integer("badge_tier_notified").notNull().default(0),
    // Set when the person finishes or skips onboarding (/welcome); null sends them there after sign-in.
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    // Languages they read; feeds (For you, Burning now) show stories in these.
    readingLanguages: localeCode("reading_languages").array().notNull().default(sql`'{es,en}'::locale_code[]`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_username_lower_key").on(sql`lower(${t.username})`),
    check("profiles_username_format", sql`${t.username} ~ '^[A-Za-z0-9_]{3,30}$'`),
    check("profiles_display_name_length", sql`char_length(${t.displayName}) <= 80`),
    check("profiles_bio_length", sql`char_length(${t.bio}) <= 280`),
    check("profiles_pronouns_length", sql`char_length(${t.pronouns}) <= 40`),
    check("profiles_now_text_length", sql`char_length(${t.nowText}) <= 120`),
    check("profiles_influences_shape", sql`jsonb_typeof(${t.influences}) = 'object' and octet_length(${t.influences}::text) <= 4000`),
    check("profiles_email_weekday_range", sql`${t.emailWeekday} between 0 and 6`),
    check("profiles_reading_languages_size", sql`cardinality(${t.readingLanguages}) between 1 and 2`),
    // Profile photos may only point into the owner's own folder of the avatars bucket (uploaded as
    // <user id>/<uuid>.webp), so no one can set an outside image or tracking pixel via the Data API.
    check(
      "profiles_avatar_url_own_folder",
      sql`${t.avatarUrl} is null or ${t.avatarUrl} ~ ('^https?://[^/]+/storage/v1/object/public/avatars/' || ${t.id}::text || '/[0-9a-f-]{36}[.]webp$')`,
    ),
    pgPolicy("profiles_select_public", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

/**
 * Usernames people used before, so old /@name links redirect to the current one. Written only by
 * the profiles trigger (record_previous_username); the newest five per person stay reserved for them.
 */
export const previousUsernames = pgTable(
  "previous_usernames",
  {
    username: text("username").primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("previous_usernames_profile_idx").on(t.profileId, t.changedAt.desc()),
    check("previous_usernames_lowercase", sql`${t.username} = lower(${t.username})`),
    pgPolicy("previous_usernames_select_public", { for: "select", to: everyone, using: sql`true` }),
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

// ---------------------------------------------------------------------------
// Phase 2: social
// ---------------------------------------------------------------------------

const LIVE_STORY = (storyId: AnyPgColumn) =>
  sql`exists (select 1 from public.stories s where s.id = ${storyId} and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now())`;

export const notificationType = pgEnum("notification_type", [
  "spark",
  "response",
  "reply",
  "mention",
  "follow",
  "submission",
  "accepted",
  "declined",
  // A new writing tier (notifications.badge holds its key) or the donor badge being granted.
  "badge",
  "donor",
  // Someone asked to join a private circle (to its owner and editors), or was let in.
  "join_request",
  "join_accepted",
]);

/** A reader following a writer or a topic (circles later). Exactly one target is set. */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    followedUserId: uuid("followed_user_id").references(() => profiles.id, { onDelete: "cascade" }),
    followedTopicId: uuid("followed_topic_id").references(() => topics.id, { onDelete: "cascade" }),
    followedCircleId: uuid("followed_circle_id").references((): AnyPgColumn => circles.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    check("follows_one_target", sql`num_nonnulls(${t.followedUserId}, ${t.followedTopicId}, ${t.followedCircleId}) = 1`),
    check("follows_not_self", sql`${t.followedUserId} is distinct from ${t.followerId}`),
    uniqueIndex("follows_user_key").on(t.followerId, t.followedUserId).where(sql`${t.followedUserId} is not null`),
    uniqueIndex("follows_topic_key").on(t.followerId, t.followedTopicId).where(sql`${t.followedTopicId} is not null`),
    uniqueIndex("follows_circle_key").on(t.followerId, t.followedCircleId).where(sql`${t.followedCircleId} is not null`),
    index("follows_followed_user_idx").on(t.followedUserId),
    index("follows_followed_topic_idx").on(t.followedTopicId),
    index("follows_followed_circle_idx").on(t.followedCircleId),
    pgPolicy("follows_select_public", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("follows_insert_own", { for: "insert", to: authenticatedRole, withCheck: sql`${t.followerId} = ${authUid}` }),
    pgPolicy("follows_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.followerId} = ${authUid}` }),
  ],
);

/** Up to 50 sparks per reader per story; one row holds the reader's total. */
export const sparks = pgTable(
  "sparks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    count: integer("count").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sparks_user_story_key").on(t.userId, t.storyId),
    index("sparks_story_idx").on(t.storyId),
    check("sparks_count_range", sql`${t.count} between 1 and 50`),
    pgPolicy("sparks_select_public", { for: "select", to: everyone, using: sql`true` }),
    // Only live stories, and never your own.
    pgPolicy("sparks_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and ${LIVE_STORY(t.storyId)} and not exists (select 1 from public.stories s where s.id = ${t.storyId} and s.author_id = ${authUid})`,
    }),
    pgPolicy("sparks_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("sparks_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

/** Private reading list ("Saved" / "Leña guardada"). */
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookmarks_user_story_key").on(t.userId, t.storyId),
    index("bookmarks_user_idx").on(t.userId, t.createdAt.desc()),
    pgPolicy("bookmarks_select_own", { for: "select", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
    pgPolicy("bookmarks_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and exists (select 1 from public.stories s where s.id = ${t.storyId})`,
    }),
    pgPolicy("bookmarks_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

/** Responses: top-level or one-level replies, optionally anchored to a paragraph (block id). */
/**
 * Embers (Brasas): passages a reader keeps from a story. Private to the reader; they count,
 * anonymously, toward Burning now. Offsets are into the block's text (`blockTexts()`), and the
 * quote is kept so the ember survives small edits around it.
 */
export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    blockId: text("block_id").notNull(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    quote: text("quote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("highlights_user_passage_key").on(t.userId, t.storyId, t.blockId, t.startOffset, t.endOffset),
    index("highlights_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("highlights_story_idx").on(t.storyId, t.createdAt),
    check("highlights_block_id_format", sql`${t.blockId} ~ '^[0-9a-f-]{36}$'`),
    check("highlights_offsets", sql`${t.startOffset} >= 0 and ${t.endOffset} > ${t.startOffset}`),
    check("highlights_quote_length", sql`char_length(${t.quote}) between 1 and 600`),
    pgPolicy("highlights_select_own", { for: "select", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
    pgPolicy("highlights_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and ${LIVE_STORY(t.storyId)}`,
    }),
    pgPolicy("highlights_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => responses.id, { onDelete: "cascade" }),
    blockId: text("block_id"),
    body: text("body").notNull(),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("responses_story_idx").on(t.storyId, t.createdAt),
    index("responses_parent_idx").on(t.parentId),
    check("responses_body_length", sql`char_length(btrim(${t.body})) between 1 and 4000`),
    check(
      "responses_block_id_format",
      sql`${t.blockId} is null or ${t.blockId} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
    ),
    pgPolicy("responses_select_visible", {
      for: "select",
      to: everyone,
      using: sql`${t.deletedAt} is null and exists (select 1 from public.stories s where s.id = ${t.storyId})`,
    }),
    // Authors see their own (even soft-deleted) responses; needed so soft-deleting passes RLS.
    pgPolicy("responses_select_own", { for: "select", to: authenticatedRole, using: sql`${t.authorId} = ${authUid}` }),
    // New responses can't arrive pinned or deleted (pinning goes through set_response_pinned()).
    pgPolicy("responses_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.authorId} = ${authUid} and ${t.pinnedAt} is null and ${t.deletedAt} is null and ${LIVE_STORY(t.storyId)}`,
    }),
    pgPolicy("responses_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.authorId} = ${authUid} and ${t.deletedAt} is null`,
      withCheck: sql`${t.authorId} = ${authUid}`,
    }),
  ],
);

/** One spark per reader per response. */
export const responseSparks = pgTable(
  "response_sparks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("response_sparks_user_response_key").on(t.userId, t.responseId),
    index("response_sparks_response_idx").on(t.responseId),
    pgPolicy("response_sparks_select_public", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("response_sparks_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and exists (select 1 from public.responses r where r.id = ${t.responseId} and r.author_id <> ${authUid})`,
    }),
    pgPolicy("response_sparks_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

/**
 * Grouped notifications ("12 people sparked your story"). Written only by
 * database triggers; one unread row per recipient, type and target.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }),
    responseId: uuid("response_id").references(() => responses.id, { onDelete: "cascade" }),
    circleId: uuid("circle_id").references((): AnyPgColumn => circles.id, { onDelete: "cascade" }),
    // Badge notifications: the writing tier key ("candle"…) or "donor". They have no actors.
    badge: text("badge"),
    actorIds: uuid("actor_ids").array().notNull().default(sql`'{}'::uuid[]`),
    actorCount: integer("actor_count").notNull().default(1),
    readAt: timestamp("read_at", { withTimezone: true }),
    // Set once the notification has been included in a summary email.
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.updatedAt.desc()),
    index("notifications_unemailed_idx").on(t.userId).where(sql`${t.readAt} is null and ${t.emailedAt} is null`),
    uniqueIndex("notifications_unread_group_key")
      .on(
        t.userId,
        t.type,
        sql`coalesce(${t.storyId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`coalesce(${t.responseId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        // Join requests have no story: keep each circle's requests in their own group.
        sql`coalesce(${t.circleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${t.readAt} is null`),
    pgPolicy("notifications_select_own", { for: "select", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
    pgPolicy("notifications_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("notifications_delete_own", { for: "delete", to: authenticatedRole, using: sql`${t.userId} = ${authUid}` }),
  ],
);

// ---------------------------------------------------------------------------
// Phase 2: circles (community publications)
// ---------------------------------------------------------------------------

export const circleRole = pgEnum("circle_role", ["owner", "editor", "writer"]);
export const submissionStatus = pgEnum("submission_status", ["pending", "accepted", "declined"]);

/** Owners and editors may change a circle and decide on submissions. */
const CIRCLE_EDITOR = (circleId: AnyPgColumn) =>
  sql`exists (select 1 from public.circle_members m where m.circle_id = ${circleId} and m.user_id = ${authUid} and m.role in ('owner', 'editor'))`;

export const circles = pgTable(
  "circles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    accentColor: text("accent_color").notNull().default("#c2410c"),
    headerUrl: text("header_url"),
    headerAlt: text("header_alt").notNull().default(""),
    headerCredit: jsonb("header_credit").$type<ImageCredit>(),
    // Private circles stay listed and readable; only members publish, others ask to join.
    isPrivate: boolean("is_private").notNull().default(false),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("circles_slug_key").on(sql`lower(${t.slug})`),
    check("circles_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.slug}) between 3 and 40`),
    check("circles_name_length", sql`char_length(btrim(${t.name})) between 2 and 60`),
    check("circles_description_length", sql`char_length(${t.description}) <= 280`),
    check("circles_accent_format", sql`${t.accentColor} ~ '^#[0-9a-fA-F]{6}$'`),
    check("circles_header_alt_length", sql`char_length(${t.headerAlt}) <= 300`),
    pgPolicy("circles_select_public", { for: "select", to: everyone, using: sql`true` }),
    pgPolicy("circles_insert_own", { for: "insert", to: authenticatedRole, withCheck: sql`${t.ownerId} = ${authUid}` }),
    pgPolicy("circles_update_editors", {
      for: "update",
      to: authenticatedRole,
      using: CIRCLE_EDITOR(t.id),
      withCheck: CIRCLE_EDITOR(t.id),
    }),
  ],
);

/** Owner (one, created by trigger), editors, and writers whose submissions skip review. */
export const circleMembers = pgTable(
  "circle_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circleId: uuid("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: circleRole("role").notNull().default("editor"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("circle_members_circle_user_key").on(t.circleId, t.userId),
    index("circle_members_user_idx").on(t.userId),
    pgPolicy("circle_members_select_public", { for: "select", to: everyone, using: sql`true` }),
    // Only the owner adds people, and never another owner.
    pgPolicy("circle_members_insert_owner", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.role} <> 'owner' and exists (select 1 from public.circle_members m where m.circle_id = ${t.circleId} and m.user_id = ${authUid} and m.role = 'owner')`,
    }),
    // Members can leave; the owner can remove anyone except themselves.
    pgPolicy("circle_members_delete", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.role} <> 'owner' and (${t.userId} = ${authUid} or exists (select 1 from public.circle_members m where m.circle_id = ${t.circleId} and m.user_id = ${authUid} and m.role = 'owner'))`,
    }),
  ],
);

/** A writer's story offered to a circle; editors accept or decline. One active circle per story. */
export const circleSubmissions = pgTable(
  "circle_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circleId: uuid("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: submissionStatus("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("circle_submissions_active_story_key")
      .on(t.storyId)
      .where(sql`${t.status} in ('pending', 'accepted')`),
    index("circle_submissions_circle_idx").on(t.circleId, t.status, t.updatedAt.desc()),
    pgPolicy("circle_submissions_select_accepted", { for: "select", to: everyone, using: sql`${t.status} = 'accepted'` }),
    pgPolicy("circle_submissions_select_involved", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.submittedBy} = ${authUid} or ${CIRCLE_EDITOR(t.circleId)}`,
    }),
    pgPolicy("circle_submissions_insert_author", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.submittedBy} = ${authUid} and ${t.status} = 'pending' and ${t.decidedBy} is null and exists (select 1 from public.stories s where s.id = ${t.storyId} and s.author_id = ${authUid} and s.deleted_at is null and s.status in ('published', 'unlisted') and s.published_at <= now()) and (not exists (select 1 from public.circles c where c.id = ${t.circleId} and c.is_private) or exists (select 1 from public.circle_members m where m.circle_id = ${t.circleId} and m.user_id = ${authUid}))`,
    }),
    pgPolicy("circle_submissions_update_editors", {
      for: "update",
      to: authenticatedRole,
      using: CIRCLE_EDITOR(t.circleId),
      withCheck: CIRCLE_EDITOR(t.circleId),
    }),
    // Writers can withdraw; editors can remove a story from their circle.
    pgPolicy("circle_submissions_delete", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.submittedBy} = ${authUid} or ${CIRCLE_EDITOR(t.circleId)}`,
    }),
  ],
);

export const joinRequestStatus = pgEnum("join_request_status", ["pending", "declined"]);

/**
 * Asking to join a private circle. Owners and editors decide through decide_join_request(); an
 * accepted request becomes a writer membership and the row goes away. Declined rows stay, so the
 * same person can't ask again and again.
 */
export const circleJoinRequests = pgTable(
  "circle_join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    circleId: uuid("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: joinRequestStatus("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("circle_join_requests_circle_user_key").on(t.circleId, t.userId),
    index("circle_join_requests_circle_idx").on(t.circleId, t.status, t.createdAt),
    index("circle_join_requests_user_idx").on(t.userId),
    pgPolicy("circle_join_requests_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid} or ${CIRCLE_EDITOR(t.circleId)}`,
    }),
    // Only for private circles the person isn't in yet, and only as a fresh request.
    pgPolicy("circle_join_requests_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid} and ${t.status} = 'pending' and ${t.decidedBy} is null and exists (select 1 from public.circles c where c.id = ${t.circleId} and c.is_private) and not exists (select 1 from public.circle_members m where m.circle_id = ${t.circleId} and m.user_id = ${authUid})`,
    }),
    // People can take back a request that's still waiting.
    pgPolicy("circle_join_requests_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid} and ${t.status} = 'pending'`,
    }),
  ],
);

export type Circle = typeof circles.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

/**
 * Private log of donor badges the owner granted or removed. Only admins can read it; writes go
 * through grant_donor_badge / remove_donor_badge, which also set profiles.donor_since.
 */
export const donorGrants = pgTable(
  "donor_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => profiles.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    // When the badge runs out after this grant (two months, stacked on time left).
    endsAt: timestamp("ends_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [
    index("donor_grants_user_idx").on(t.userId, t.grantedAt.desc()),
    check("donor_grants_note_length", sql`char_length(${t.note}) <= 500`),
    pgPolicy("donor_grants_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: sql`coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)`,
    }),
  ],
);

export const moderationStatus = pgEnum("moderation_status", ["nsfw", "removed"]);

/**
 * Current moderation of a story (one row while moderated). Public to read: the reason is shown on
 * the story. Written only by moderate_story(), which checks the admin role, so authors can't undo it.
 */
export const storyModeration = pgTable(
  "story_moderation",
  {
    storyId: uuid("story_id")
      .primaryKey()
      .references(() => stories.id, { onDelete: "cascade" }),
    status: moderationStatus("status").notNull(),
    reason: text("reason").notNull(),
    moderatedBy: uuid("moderated_by").references(() => profiles.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("story_moderation_status_idx").on(t.status),
    check("story_moderation_reason_length", sql`char_length(btrim(${t.reason})) between 1 and 300`),
    pgPolicy("story_moderation_select_public", { for: "select", to: everyone, using: sql`true` }),
  ],
);

/** Every moderation action, including restores. Private to admins. */
export const moderationLog = pgTable(
  "moderation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    // null means the moderation was lifted.
    status: moderationStatus("status"),
    reason: text("reason").notNull().default(""),
    moderatorId: uuid("moderator_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("moderation_log_story_idx").on(t.storyId, t.createdAt.desc()),
    pgPolicy("moderation_log_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: sql`coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)`,
    }),
  ],
);

