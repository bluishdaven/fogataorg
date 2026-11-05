import { sql, type SQL } from "drizzle-orm";

const NOT_REMOVED = (story: string) =>
  `not exists (select 1 from public.story_moderation sm where sm.story_id = ${story}.id and sm.status = 'removed')`;

/**
 * Published, public stories by the profile whose id is `profileId`: the count writing tiers use.
 * Stories removed by moderation don't count. Pass a qualified column (single-table Drizzle queries
 * render ${profiles.id} unqualified, which a subquery would read as stories.id).
 */
export function publishedCountSql(profileId: SQL = sql.raw('"profiles"."id"')) {
  return sql<number>`(select count(*)::int from public.stories ps where ps.author_id = ${profileId} and ps.status = 'published' and ps.deleted_at is null and ps.published_at <= now() and ${sql.raw(NOT_REMOVED("ps"))})`;
}

/** The same count for raw SQL queries that alias profiles (e.g. `p`). */
export function publishedCountRaw(alias: string) {
  return sql.raw(
    `(select count(*)::int from public.stories ps where ps.author_id = ${alias}.id and ps.status = 'published' and ps.deleted_at is null and ps.published_at <= now() and ${NOT_REMOVED("ps")})`,
  );
}

/** Whether the donor badge is current (its two months haven't run out). Checked in SQL, not JS. */
export function donorActiveSql(column: SQL = sql.raw('"profiles"."donor_until"')) {
  return sql<boolean>`coalesce(${column} > now(), false)`;
}

export function donorActiveRaw(alias: string) {
  return sql.raw(`coalesce(${alias}.donor_until > now(), false)`);
}
