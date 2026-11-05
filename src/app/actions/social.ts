"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { bookmarks, follows, notifications, responses, responseSparks, sparks, stories } from "@/lib/db/schema";
import type { TiptapDoc } from "@/lib/domain/content";
import {
  blockTexts,
  bookmarkSchema,
  followSchema,
  responseIdSchema,
  responseSchema,
  sparksSchema,
  type ResponseInput,
} from "@/lib/domain/social";

type Ok<T = object> = { ok: true } & T;
type Fail = { ok: false; error: "unauthorized" | "invalid" | "not_allowed" | "empty" | "tooLong" };

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
    return { ok: true as const, count };
  });
}

export async function setBookmark(input: unknown): Promise<Ok<{ saved: boolean }> | Fail> {
  const parsed = bookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { storyId, saved } = parsed.data;
  return asViewer(async (viewer) => {
    await withRls(viewer.claims, async (tx) => {
      if (saved) {
        await tx.insert(bookmarks).values({ userId: viewer.id, storyId }).onConflictDoNothing();
      } else {
        await tx.delete(bookmarks).where(and(eq(bookmarks.storyId, storyId), eq(bookmarks.userId, viewer.id)));
      }
    });
    return { ok: true as const, saved };
  });
}

export type PostedResponse = {
  id: string;
  parentId: string | null;
  blockId: string | null;
  body: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string };
};

export async function postResponse(input: ResponseInput): Promise<Ok<{ response: PostedResponse }> | Fail> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === "empty" || message === "tooLong" ? message : "invalid" };
  }
  const { storyId, parentId, blockId, body } = parsed.data;
  return asViewer(async (viewer) => {
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
    return {
      ok: true as const,
      response: {
        id: created.id,
        parentId: created.parentId,
        blockId: created.blockId,
        body,
        createdAt: created.createdAt.toISOString(),
        author: { id: viewer.id, username: viewer.username, displayName: viewer.displayName },
      },
    };
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
