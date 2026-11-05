import { desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/rls-context";
import { notifications, profiles, responses, stories } from "@/lib/db/schema";
import { excerpt } from "@/lib/domain/content";
import type { NotificationItem } from "@/lib/domain/notification-text";

export type NotificationRow = NotificationItem & {
  id: string;
  unread: boolean;
  updatedAt: Date;
};

/**
 * Loads grouped notifications with their actors, story, response excerpt and
 * circle. Runs on whatever executor it's given: the notifications page passes
 * an RLS transaction, the summary email job the owner connection.
 */
export async function selectNotificationItems(
  tx: DbExecutor,
  where: SQL | undefined,
  limit: number,
): Promise<NotificationRow[]> {
  const rows = await tx
    .select({
      id: notifications.id,
      type: notifications.type,
      actorIds: notifications.actorIds,
      actorCount: notifications.actorCount,
      readAt: notifications.readAt,
      updatedAt: notifications.updatedAt,
      storyTitle: stories.title,
      storySlug: stories.slug,
      storyAuthor: sql<string | null>`(select p.username from public.profiles p where p.id = ${stories.authorId})`,
      responseBody: responses.body,
      circleName: sql<string | null>`(select c.name from public.circles c where c.id = ${notifications.circleId})`,
      circleSlug: sql<string | null>`(select c.slug from public.circles c where c.id = ${notifications.circleId})`,
      badge: notifications.badge,
      recipient: sql<string>`(select p.username from public.profiles p where p.id = ${notifications.userId})`,
    })
    .from(notifications)
    .leftJoin(stories, eq(stories.id, notifications.storyId))
    .leftJoin(responses, eq(responses.id, notifications.responseId))
    .where(where)
    .orderBy(desc(notifications.updatedAt))
    .limit(limit);

  const actorIds = [...new Set(rows.flatMap((row) => row.actorIds.slice(0, 2)))];
  const actors = actorIds.length
    ? await tx
        .select({ id: profiles.id, username: profiles.username, displayName: profiles.displayName })
        .from(profiles)
        .where(inArray(profiles.id, actorIds))
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return rows.map((row) => {
    const first = actorById.get(row.actorIds[0] ?? "");
    return {
      id: row.id,
      type: row.type,
      unread: !row.readAt,
      updatedAt: row.updatedAt,
      actor: first ? { username: first.username, name: first.displayName || first.username } : null,
      others: Math.max(0, row.actorCount - 1),
      story: row.storySlug && row.storyAuthor ? { title: row.storyTitle ?? "", slug: row.storySlug, author: row.storyAuthor } : null,
      responseExcerpt: row.responseBody ? excerpt(row.responseBody, 90) : null,
      circle: row.circleSlug && row.circleName ? { slug: row.circleSlug, name: row.circleName } : null,
      badge: row.badge ? { key: row.badge, username: row.recipient } : null,
    };
  });
}
