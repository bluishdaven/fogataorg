import { sql, type SQL } from "drizzle-orm";

/**
 * Published, public stories by the profile whose id is `profileId`: the count writing tiers use.
 * Pass a qualified column (single-table Drizzle queries render ${profiles.id} unqualified, which a
 * subquery would read as stories.id).
 */
export function publishedCountSql(profileId: SQL = sql.raw('"profiles"."id"')) {
  return sql<number>`(select count(*)::int from public.stories ps where ps.author_id = ${profileId} and ps.status = 'published' and ps.deleted_at is null and ps.published_at <= now())`;
}

/** The same count for raw SQL queries that alias profiles (e.g. `p`). */
export function publishedCountRaw(alias: string) {
  return sql.raw(
    `(select count(*)::int from public.stories ps where ps.author_id = ${alias}.id and ps.status = 'published' and ps.deleted_at is null and ps.published_at <= now())`,
  );
}
