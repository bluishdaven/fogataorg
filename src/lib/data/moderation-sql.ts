import { sql } from "drizzle-orm";

/**
 * Moderation filters for queries over `stories` (written with the qualified "stories"."id" so they
 * also work in single-table queries). Removed stories leave every list; NSFW stories stay on the
 * writer's profile and in saved lists (labelled) but leave feeds: home, topics, circles, search.
 */
export const notRemoved = sql`not exists (select 1 from public.story_moderation sm where sm.story_id = "stories"."id" and sm.status = 'removed')`;

export const notModerated = sql`not exists (select 1 from public.story_moderation sm where sm.story_id = "stories"."id")`;

export const moderationStatusSql = sql<"nsfw" | "removed" | null>`(select sm.status::text from public.story_moderation sm where sm.story_id = "stories"."id")`;

export const moderationReasonSql = sql<string | null>`(select sm.reason from public.story_moderation sm where sm.story_id = "stories"."id")`;
