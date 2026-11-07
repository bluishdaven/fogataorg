import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import {
  bookmarks,
  follows,
  notifications,
  profiles,
  responses,
  responseSparks,
  sparks,
  stories,
  topics,
} from "@/lib/db/schema";
import { badgeData, type BadgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { donorActiveSql, publishedCountSql } from "./badge-sql";
import { moderationStatusSql, notRemoved } from "./moderation-sql";
import { selectNotificationItems } from "./notification-items";
import { isAllowedStoryImage } from "@/lib/story-images";

/**
 * Per-reader social data. Never cached: it depends on who's asking. Runs as
 * the reader (or anon), so RLS keeps bookmarks and notifications private.
 */

const claimsOf = (viewer: Viewer | null) => viewer?.claims ?? null;

export async function getStorySocial(viewer: Viewer | null, storyId: string, authorId: string) {
  return withRls(claimsOf(viewer), async (tx) => {
    const [totals] = await tx
      .select({ total: sum(sparks.count).mapWith(Number), readers: count() })
      .from(sparks)
      .where(eq(sparks.storyId, storyId));
    const [responseCount] = await tx
      .select({ value: count() })
      .from(responses)
      .where(and(eq(responses.storyId, storyId), isNull(responses.deletedAt)));
    const [followers] = await tx.select({ value: count() }).from(follows).where(eq(follows.followedUserId, authorId));

    let mine = 0;
    let saved = false;
    let following = false;
    if (viewer) {
      const [own] = await tx
        .select({ count: sparks.count })
        .from(sparks)
        .where(and(eq(sparks.storyId, storyId), eq(sparks.userId, viewer.id)));
      mine = own?.count ?? 0;
      const [bookmark] = await tx
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.storyId, storyId), eq(bookmarks.userId, viewer.id)));
      saved = Boolean(bookmark);
      const [follow] = await tx
        .select({ id: follows.id })
        .from(follows)
        .where(and(eq(follows.followerId, viewer.id), eq(follows.followedUserId, authorId)));
      following = Boolean(follow);
    }

    return {
      sparkTotal: totals?.total ?? 0,
      sparkReaders: totals?.readers ?? 0,
      responseCount: responseCount?.value ?? 0,
      followerCount: followers?.value ?? 0,
      mine,
      saved,
      following,
      signedIn: Boolean(viewer),
      isAuthor: viewer?.id === authorId,
    };
  });
}

export type ResponseView = {
  id: string;
  parentId: string | null;
  blockId: string | null;
  body: string;
  createdAt: Date;
  pinned: boolean;
  edited: boolean;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; pronouns: string; badges: BadgeData };
  sparks: number;
  sparkedByViewer: boolean;
  replies: ResponseView[];
};

export async function listResponses(viewer: Viewer | null, storyId: string): Promise<ResponseView[]> {
  return withRls(claimsOf(viewer), async (tx) => {
    const rows = await tx
      .select({
        id: responses.id,
        parentId: responses.parentId,
        blockId: responses.blockId,
        body: responses.body,
        createdAt: responses.createdAt,
        pinnedAt: responses.pinnedAt,
        editedAt: responses.editedAt,
        authorId: profiles.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        pronouns: profiles.pronouns,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
      })
      .from(responses)
      .innerJoin(profiles, eq(profiles.id, responses.authorId))
      .where(and(eq(responses.storyId, storyId), isNull(responses.deletedAt)))
      .orderBy(asc(responses.createdAt))
      .limit(500);
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const sparkCounts = await tx
      .select({ responseId: responseSparks.responseId, value: count() })
      .from(responseSparks)
      .where(inArray(responseSparks.responseId, ids))
      .groupBy(responseSparks.responseId);
    const countById = new Map(sparkCounts.map((r) => [r.responseId, r.value]));
    const mine = viewer
      ? new Set(
          (
            await tx
              .select({ responseId: responseSparks.responseId })
              .from(responseSparks)
              .where(and(inArray(responseSparks.responseId, ids), eq(responseSparks.userId, viewer.id)))
          ).map((r) => r.responseId),
        )
      : new Set<string>();

    const views = new Map<string, ResponseView>();
    for (const row of rows) {
      views.set(row.id, {
        id: row.id,
        parentId: row.parentId,
        blockId: row.blockId,
        body: row.body,
        createdAt: row.createdAt,
        pinned: Boolean(row.pinnedAt),
        edited: Boolean(row.editedAt),
        author: {
          id: row.authorId,
          username: row.username,
          displayName: row.displayName || row.username,
          avatarUrl: row.avatarUrl,
          pronouns: row.pronouns,
          badges: badgeData(row),
        },
        sparks: countById.get(row.id) ?? 0,
        sparkedByViewer: mine.has(row.id),
        replies: [],
      });
    }
    const top: ResponseView[] = [];
    for (const view of views.values()) {
      const parent = view.parentId ? views.get(view.parentId) : null;
      if (parent) parent.replies.push(view);
      else if (!view.parentId) top.push(view);
    }
    // Pinned first, then oldest first so conversations read in order.
    return top.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.getTime() - b.createdAt.getTime());
  });
}

export async function getFollowState(viewer: Viewer | null, target: { userId?: string; topicId?: string }) {
  return withRls(claimsOf(viewer), async (tx) => {
    const condition = target.userId ? eq(follows.followedUserId, target.userId) : eq(follows.followedTopicId, target.topicId!);
    const [followers] = await tx.select({ value: count() }).from(follows).where(condition);
    const following =
      viewer && target.userId
        ? (await tx.select({ value: count() }).from(follows).where(eq(follows.followerId, target.userId)))[0]?.value ?? 0
        : null;
    const [mine] = viewer
      ? await tx.select({ id: follows.id }).from(follows).where(and(condition, eq(follows.followerId, viewer.id)))
      : [];
    return { followers: followers?.value ?? 0, following, isFollowing: Boolean(mine), signedIn: Boolean(viewer) };
  });
}

export async function listSaved(viewer: Viewer) {
  return withRls(viewer.claims, async (tx) => {
    const rows = await tx
      .select({
        title: stories.title,
        subtitle: stories.subtitle,
        slug: stories.slug,
        language: stories.language,
        readingTime: stories.readingTime,
        publishedAt: stories.publishedAt,
        contentText: sql<string>`left(${stories.contentText}, 400)`,
        thumbnailUrl: stories.thumbnailUrl,
        thumbnailAlt: stories.thumbnailAlt,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        pronouns: profiles.pronouns,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
        moderation: moderationStatusSql,
      })
      .from(bookmarks)
      .innerJoin(stories, eq(stories.id, bookmarks.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(bookmarks.userId, viewer.id), isNull(stories.deletedAt), notRemoved))
      .orderBy(desc(bookmarks.createdAt))
      .limit(200);
    return rows.map((row) => ({
      title: row.title,
      subtitle: row.subtitle,
      slug: row.slug,
      language: row.language,
      readingTime: row.readingTime,
      publishedAt: row.publishedAt,
      excerpt: excerpt(row.contentText),
      nsfw: row.moderation === "nsfw",
      thumbnail:
        row.moderation !== "nsfw" && row.thumbnailUrl && isAllowedStoryImage(row.thumbnailUrl)
          ? { url: row.thumbnailUrl, alt: row.thumbnailAlt }
          : null,
      author: {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        pronouns: row.pronouns,
        badges: badgeData(row),
      },
    }));
  });
}

export async function unreadNotificationCount(viewer: Viewer): Promise<number> {
  return withRls(viewer.claims, async (tx) => {
    const [row] = await tx
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)));
    return row?.value ?? 0;
  });
}

export async function listNotifications(viewer: Viewer) {
  return withRls(viewer.claims, (tx) => selectNotificationItems(tx, eq(notifications.userId, viewer.id), 100));
}

export async function getTopicId(slug: string): Promise<string | null> {
  return withRls(null, async (tx) => {
    const [row] = await tx.select({ id: topics.id }).from(topics).where(eq(topics.slug, slug)).limit(1);
    return row?.id ?? null;
  });
}
