"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { allowAction } from "@/lib/limits";
import { pushSoon } from "@/lib/push/soon";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { bookmarks, follows, notifications, readingLists, responses, responseSparks, sparks, stories, userBlocks } from "@/lib/db/schema";
import { getSaveState, listOfflineCandidates } from "@/lib/data/social";
import { OFFLINE_SAVED_LIMIT } from "@/lib/domain/app";
import { storyPath } from "@/lib/domain/handle-routes";
import type { TiptapDoc } from "@/lib/domain/content";
import {
  blockSchema,
  blockTexts,
  bookmarkSchema,
  createReadingListSchema,
  followSchema,
  renameReadingListSchema,
  responseEditSchema,
  responseIdSchema,
  responseSchema,
  sparksSchema,
  type ResponseInput,
} from "@/lib/domain/social";
import type { BadgeData } from "@/lib/domain/badges";

type Ok<T = object> = { ok: true } & T;
type Fail = {
  ok: false;
  error: "unauthorized" | "invalid" | "not_allowed" | "empty" | "tooLong" | "rateLimited" | "listName" | "listExists" | "tooManyLists";
};

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

async function asViewer<T>(fn: (viewer: NonNullable<Awaited<ReturnType<typeof getViewer>>>) => Promise<T>): Promise<T | Fail> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  try {
    return await fn(viewer);
  } catch (error) {
    if (pgCode(error) === "42501") return { ok: false, error: "not_allowed" };
    throw error;
  }
}

export async function setFollow(input: unknown): Promise<Ok<{ following: boolean }> | Fail> {
  const parsed = followSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { target, id, follow } = parsed.data;
  return asViewer(async (viewer) => {
    if (follow && !(await allowAction(viewer, "follow"))) return { ok: false as const, error: "rateLimited" as const };
    await withRls(viewer.claims, async (tx) => {
      const column = { user: follows.followedUserId, topic: follows.followedTopicId, circle: follows.followedCircleId }[target];
      const condition = and(eq(follows.followerId, viewer.id), eq(column, id));
      if (follow) {
        const values =
          target === "user"
            ? { followerId: viewer.id, followedUserId: id }
            : target === "topic"
              ? { followerId: viewer.id, followedTopicId: id }
              : { followerId: viewer.id, followedCircleId: id };
        await tx.insert(follows).values(values).onConflictDoNothing();
      } else {
        await tx.delete(follows).where(condition);
      }
    });
    if (follow) pushSoon();
    return { ok: true as const, following: follow };
  });
}

/** Saves the reader's spark total for a story (0 removes them). */
export async function setSparks(input: unknown): Promise<Ok<{ count: number }> | Fail> {
  const parsed = sparksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { storyId, count } = parsed.data;
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, async (tx) => {
      if (count === 0) {
        await tx.delete(sparks).where(and(eq(sparks.storyId, storyId), eq(sparks.userId, viewer.id)));
      } else {
        await tx
          .insert(sparks)
          .values({ userId: viewer.id, storyId, count })
          .onConflictDoUpdate({ target: [sparks.userId, sparks.storyId], set: { count } });
      }
    });
    if (count > 0) pushSoon();
    return { ok: true as const, count };
  });
}

/** Puts a story in one of the reader's lists or takes it out (no list: the default Saved list). */
export async function setBookmark(input: unknown): Promise<Ok<{ saved: boolean }> | Fail> {
  const parsed = bookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { storyId, saved, listId } = parsed.data;
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, async (tx) => {
      if (saved) {
        await tx.insert(bookmarks).values({ userId: viewer.id, storyId, listId }).onConflictDoNothing();
      } else {
        await tx
          .delete(bookmarks)
          .where(
            and(
              eq(bookmarks.storyId, storyId),
              eq(bookmarks.userId, viewer.id),
              listId ? eq(bookmarks.listId, listId) : isNull(bookmarks.listId),
            ),
          );
      }
    });
    return { ok: true as const, saved };
  });
}

export type SaveLists = { lists: { id: string; name: string }[]; inLists: (string | null)[] };

/** The reader's lists and which ones hold this story, for the save menu. */
/** The saved stories this device should keep offline (newest first, each once). */
export async function getOfflineStories(): Promise<Ok<{ stories: { url: string; title: string; author: string }[] }> | Fail> {
  return asViewer(async (viewer) => {
    const rows = await listOfflineCandidates(viewer, OFFLINE_SAVED_LIMIT);
    return { ok: true as const, stories: rows.map((row) => ({ url: storyPath(row.username, row.slug), title: row.title, author: row.author })) };
  });
}

export async function getSaveLists(storyId: string): Promise<Ok<SaveLists> | Fail> {
  if (!responseIdSchema.safeParse(storyId).success) return { ok: false, error: "invalid" };
  return asViewer(async (viewer) => ({ ok: true as const, ...(await getSaveState(viewer, storyId)) }));
}

function listError(error: unknown): Fail | null {
  const code = pgCode(error);
  if (code === "23505") return { ok: false, error: "listExists" };
  if (code === "54000") return { ok: false, error: "tooManyLists" };
  return null;
}

/** Starts a reading list, and puts the story in it when one is given. */
export async function createReadingList(input: unknown): Promise<Ok<{ list: { id: string; name: string } }> | Fail> {
  const parsed = createReadingListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "listName" };
  const { name, storyId } = parsed.data;
  return asViewer(async (viewer) => {
    try {
      const list = await withRls(viewer.claims, async (tx) => {
        const [row] = await tx
          .insert(readingLists)
          .values({ userId: viewer.id, name })
          .returning({ id: readingLists.id, name: readingLists.name });
        if (storyId) await tx.insert(bookmarks).values({ userId: viewer.id, storyId, listId: row!.id }).onConflictDoNothing();
        return row!;
      });
      return { ok: true as const, list };
    } catch (error) {
      const failed = listError(error);
      if (failed) return failed;
      throw error;
    }
  });
}

export async function renameReadingList(input: unknown): Promise<Ok | Fail> {
  const parsed = renameReadingListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "listName" };
  const { id, name } = parsed.data;
  return asViewer(async (viewer) => {
    try {
      const rows = await withRls(viewer.claims, (tx) =>
        tx.update(readingLists).set({ name }).where(eq(readingLists.id, id)).returning({ id: readingLists.id }),
      );
      return rows.length ? { ok: true as const } : { ok: false as const, error: "not_allowed" as const };
    } catch (error) {
      const failed = listError(error);
      if (failed) return failed;
      throw error;
    }
  });
}

/** Deletes a list; its stories stay in any other list they're in. */
export async function deleteReadingList(id: string): Promise<Ok | Fail> {
  if (!responseIdSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  return asViewer(async (viewer) => {
    const rows = await withRls(viewer.claims, (tx) => tx.delete(readingLists).where(eq(readingLists.id, id)).returning({ id: readingLists.id }));
    return rows.length ? { ok: true as const } : { ok: false as const, error: "not_allowed" as const };
  });
}

export type PostedResponse = {
  id: string;
  parentId: string | null;
  blockId: string | null;
  body: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; pronouns: string; badges: BadgeData };
};

export async function postResponse(input: ResponseInput): Promise<Ok<{ response: PostedResponse }> | Fail> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === "empty" || message === "tooLong" ? message : "invalid" };
  }
  const { storyId, parentId, blockId, body } = parsed.data;
  return asViewer(async (viewer) => {
    if (!(await allowAction(viewer, "respond"))) return { ok: false as const, error: "rateLimited" as const };
    const created = await withRls(viewer.claims, async (tx) => {
      if (blockId) {
        // The anchor must be a block of the published story.
        const [story] = await tx.select({ content: stories.content }).from(stories).where(eq(stories.id, storyId)).limit(1);
        if (!story || !(blockId in blockTexts(story.content as TiptapDoc))) return null;
      }
      const [row] = await tx
        .insert(responses)
        .values({ storyId, authorId: viewer.id, parentId, blockId: parentId ? null : blockId, body })
        .returning({ id: responses.id, createdAt: responses.createdAt, parentId: responses.parentId, blockId: responses.blockId });
      return row ?? null;
    });
    if (!created) return { ok: false as const, error: "invalid" as const };
    pushSoon();
    return {
      ok: true as const,
      response: {
        id: created.id,
        parentId: created.parentId,
        blockId: created.blockId,
        body,
        createdAt: created.createdAt.toISOString(),
        author: {
          id: viewer.id,
          username: viewer.username,
          displayName: viewer.displayName,
          avatarUrl: viewer.avatarUrl,
          pronouns: viewer.pronouns,
          badges: viewer.badges,
        },
      },
    };
  });
}

/** Authors change their own response's text; it shows as edited. */
export async function editResponse(input: unknown): Promise<Ok<{ body: string }> | Fail> {
  const parsed = responseEditSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === "empty" || message === "tooLong" ? message : "invalid" };
  }
  const { id, body } = parsed.data;
  return asViewer(async (viewer) => {
    if (!(await allowAction(viewer, "respond"))) return { ok: false as const, error: "rateLimited" as const };
    const rows = await withRls(viewer.claims, (tx) =>
      tx
        .update(responses)
        .set({ body })
        .where(and(eq(responses.id, id), eq(responses.authorId, viewer.id), isNull(responses.deletedAt)))
        .returning({ id: responses.id }),
    );
    if (!rows.length) return { ok: false as const, error: "not_allowed" as const };
    // New mentions notify.
    pushSoon();
    return { ok: true as const, body };
  });
}

export async function deleteResponse(id: string): Promise<Ok | Fail> {
  if (!responseIdSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  return asViewer(async (viewer) => {
    const rows = await withRls(viewer.claims, (tx) =>
      tx
        .update(responses)
        .set({ deletedAt: new Date() })
        .where(and(eq(responses.id, id), eq(responses.authorId, viewer.id), isNull(responses.deletedAt)))
        .returning({ id: responses.id }),
    );
    return rows.length ? { ok: true as const } : { ok: false as const, error: "not_allowed" as const };
  });
}

export async function setResponseSpark(id: string, sparked: boolean): Promise<Ok | Fail> {
  if (!responseIdSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, async (tx) => {
      if (sparked) await tx.insert(responseSparks).values({ userId: viewer.id, responseId: id }).onConflictDoNothing();
      else await tx.delete(responseSparks).where(and(eq(responseSparks.responseId, id), eq(responseSparks.userId, viewer.id)));
    });
    if (sparked) pushSoon();
    return { ok: true as const };
  });
}

export async function setResponsePinned(id: string, pinned: boolean): Promise<Ok | Fail> {
  if (!responseIdSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, (tx) => tx.execute(sql`select public.set_response_pinned(${id}, ${pinned})`));
    return { ok: true as const };
  });
}

export async function markNotificationsRead(): Promise<Ok | Fail> {
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, (tx) =>
      tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt))),
    );
    return { ok: true as const };
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  const viewer = await getViewer();
  if (!viewer) return 0;
  return withRls(viewer.claims, async (tx) => {
    const rows = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, viewer.id), isNull(notifications.readAt)))
      .limit(100);
    return rows.length;
  });
}

/** Mutes or blocks someone, or undoes it (kind null). Private: they aren't told. */
export async function setBlock(input: unknown): Promise<Ok<{ kind: "mute" | "block" | null }> | Fail> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { userId, kind } = parsed.data;
  return asViewer(async (viewer) => {
    if (userId === viewer.id) return { ok: false as const, error: "invalid" as const };
    await withRls(viewer.claims, async (tx) => {
      if (kind) {
        await tx
          .insert(userBlocks)
          .values({ blockerId: viewer.id, blockedId: userId, kind })
          .onConflictDoUpdate({ target: [userBlocks.blockerId, userBlocks.blockedId], set: { kind } });
      } else {
        await tx.delete(userBlocks).where(and(eq(userBlocks.blockerId, viewer.id), eq(userBlocks.blockedId, userId)));
      }
    });
    return { ok: true as const, kind };
  });
}
