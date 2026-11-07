import { and, eq, notInArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { notifications, responses, responseSparks, sparks, stories } from "@/lib/db/schema";
import { closeDb, scenario, type Harness } from "./harness";

afterAll(closeDb);

const HOUR = 60 * 60 * 1000;

async function makeStory(h: Harness, authorId: string) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Una historia",
      slug: `historia-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: "published",
      publishedAt: new Date(Date.now() - HOUR),
    })
    .returning();
  return row!;
}

async function socialNotifications(h: Harness, userId: string) {
  return h.tx
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), notInArray(notifications.type, ["badge", "donor"])));
}

describe("taking sparks back", () => {
  it("removes the reader from the unread notification, and the group once it's empty", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const a = await h.createUser();
      const b = await h.createUser();
      const story = await makeStory(h, writer);

      await h.as(h.claimsFor(a), (tx) => tx.insert(sparks).values({ userId: a, storyId: story.id, count: 3 }));
      await h.as(h.claimsFor(b), (tx) => tx.insert(sparks).values({ userId: b, storyId: story.id, count: 1 }));
      // now() is fixed inside a transaction: date the group earlier to see whether it moves.
      await h.tx.update(notifications).set({ updatedAt: new Date(Date.now() - HOUR) }).where(eq(notifications.userId, writer));
      const [before] = await socialNotifications(h, writer);
      expect(before).toMatchObject({ type: "spark", actorCount: 2 });

      await h.as(h.claimsFor(a), (tx) => tx.delete(sparks).where(and(eq(sparks.userId, a), eq(sparks.storyId, story.id))));
      const [after] = await socialNotifications(h, writer);
      expect(after).toMatchObject({ actorCount: 1, actorIds: [b] });
      // Leaving a group isn't new activity.
      expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());

      await h.as(h.claimsFor(b), (tx) => tx.delete(sparks).where(and(eq(sparks.userId, b), eq(sparks.storyId, story.id))));
      expect(await socialNotifications(h, writer)).toHaveLength(0);
    });
  });

  it("leaves notifications the writer already read alone", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      await h.as(h.claimsFor(reader), (tx) => tx.insert(sparks).values({ userId: reader, storyId: story.id, count: 2 }));
      await h.tx.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, writer));

      await h.as(h.claimsFor(reader), (tx) => tx.delete(sparks).where(eq(sparks.userId, reader)));
      const rows = await socialNotifications(h, writer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ actorCount: 1 });
    });
  });

  it("also takes back a response spark's notification", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const responder = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      const [response] = await h.as(h.claimsFor(responder), (tx) =>
        tx.insert(responses).values({ storyId: story.id, authorId: responder, body: "Qué bonito." }).returning(),
      );
      await h.as(h.claimsFor(reader), (tx) => tx.insert(responseSparks).values({ userId: reader, responseId: response!.id }));
      expect(await socialNotifications(h, responder)).toHaveLength(1);

      await h.as(h.claimsFor(reader), (tx) => tx.delete(responseSparks).where(eq(responseSparks.userId, reader)));
      expect(await socialNotifications(h, responder)).toHaveLength(0);
    });
  });
});
