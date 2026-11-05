import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { bookmarks, follows, notifications, responses, responseSparks, sparks, stories, topics } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const HOUR = 60 * 60 * 1000;

async function makeStory(h: Harness, authorId: string, overrides: Partial<typeof stories.$inferInsert> = {}) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Una historia",
      slug: `historia-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: "published",
      publishedAt: new Date(Date.now() - HOUR),
      ...overrides,
    })
    .returning();
  return row!;
}

async function notificationsFor(h: Harness, userId: string) {
  return h.tx.select().from(notifications).where(eq(notifications.userId, userId));
}

describe("follows", () => {
  it("lets readers follow writers and topics, once, and notifies the writer in one group", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const a = await h.createUser();
      const b = await h.createUser();
      const [topic] = await h.tx.insert(topics).values({ slug: "follow-topic", nameEn: "T", nameEs: "T" }).returning();

      await h.as(h.claimsFor(a), (tx) => tx.insert(follows).values({ followerId: a, followedUserId: writer }));
      await h.as(h.claimsFor(b), (tx) => tx.insert(follows).values({ followerId: b, followedUserId: writer }));
      await h.as(h.claimsFor(a), (tx) => tx.insert(follows).values({ followerId: a, followedTopicId: topic!.id }));

      await expectPgError(
        h.as(h.claimsFor(a), (tx) => tx.insert(follows).values({ followerId: a, followedUserId: writer })),
        PG.uniqueViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(a), (tx) => tx.insert(follows).values({ followerId: a, followedUserId: a })),
        PG.checkViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(a), (tx) => tx.insert(follows).values({ followerId: b, followedUserId: a })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(null, (tx) => tx.insert(follows).values({ followerId: a, followedUserId: b })),
        PG.insufficientPrivilege,
      );

      const [notice] = await notificationsFor(h, writer);
      expect(notice).toMatchObject({ type: "follow", actorCount: 2, readAt: null });
      expect(notice?.actorIds.sort()).toEqual([a, b].sort());
    });
  });

  it("can only be removed by the follower", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      await h.tx.insert(follows).values({ followerId: reader, followedUserId: writer });
      const byWriter = await h.as(h.claimsFor(writer), (tx) =>
        tx.delete(follows).where(eq(follows.followerId, reader)).returning({ id: follows.id }),
      );
      expect(byWriter).toHaveLength(0);
      const byReader = await h.as(h.claimsFor(reader), (tx) =>
        tx.delete(follows).where(eq(follows.followerId, reader)).returning({ id: follows.id }),
      );
      expect(byReader).toHaveLength(1);
    });
  });
});

describe("sparks", () => {
  it("allow 1–50 on live stories by others, and notify the writer on the first spark", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      const claims = h.claimsFor(reader);

      await h.as(claims, (tx) => tx.insert(sparks).values({ userId: reader, storyId: story.id, count: 3 }));
      await h.as(claims, (tx) => tx.update(sparks).set({ count: 50 }).where(eq(sparks.userId, reader)));
      await expectPgError(
        h.as(claims, (tx) => tx.update(sparks).set({ count: 51 }).where(eq(sparks.userId, reader))),
        PG.checkViolation,
      );

      const notices = await notificationsFor(h, writer);
      expect(notices).toHaveLength(1);
      expect(notices[0]).toMatchObject({ type: "spark", storyId: story.id, actorCount: 1 });
    });
  });

  it("refuse self-sparks, drafts, anonymous sparks and touching someone else's sparks", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      const draft = await makeStory(h, writer, { status: "draft", publishedAt: null });

      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(sparks).values({ userId: writer, storyId: story.id })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(sparks).values({ userId: reader, storyId: draft.id })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(null, (tx) => tx.insert(sparks).values({ userId: reader, storyId: story.id })),
        PG.insufficientPrivilege,
      );

      await h.tx.insert(sparks).values({ userId: reader, storyId: story.id, count: 5 });
      const tampered = await h.as(h.claimsFor(writer), (tx) =>
        tx.update(sparks).set({ count: 50 }).where(eq(sparks.userId, reader)).returning({ id: sparks.id }),
      );
      expect(tampered).toHaveLength(0);
    });
  });
});

describe("bookmarks", () => {
  it("are private to their owner", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const other = await h.createUser();
      const story = await makeStory(h, writer);
      await h.as(h.claimsFor(reader), (tx) => tx.insert(bookmarks).values({ userId: reader, storyId: story.id }));

      const own = await h.as(h.claimsFor(reader), (tx) => tx.select().from(bookmarks).where(eq(bookmarks.userId, reader)));
      expect(own).toHaveLength(1);
      const peek = await h.as(h.claimsFor(other), (tx) => tx.select().from(bookmarks).where(eq(bookmarks.userId, reader)));
      expect(peek).toHaveLength(0);
      await expectPgError(h.as(null, (tx) => tx.select().from(bookmarks)), PG.insufficientPrivilege);
      await expectPgError(
        h.as(h.claimsFor(other), (tx) => tx.insert(bookmarks).values({ userId: reader, storyId: story.id })),
        PG.insufficientPrivilege,
      );
    });
  });
});

describe("responses", () => {
  it("thread one level deep and notify the right people, including mentions", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser({ metadata: { username: "writer_one" } });
      const reader = await h.createUser({ metadata: { username: "reader_one" } });
      const friend = await h.createUser({ metadata: { username: "friend_one" } });
      const story = await makeStory(h, writer);

      const [top] = await h.as(h.claimsFor(reader), (tx) =>
        tx.insert(responses).values({ storyId: story.id, authorId: reader, body: "Qué bonito. @friend_one tienes que leer esto." }).returning(),
      );
      const [reply] = await h.as(h.claimsFor(writer), (tx) =>
        tx.insert(responses).values({ storyId: story.id, authorId: writer, parentId: top!.id, body: "¡Gracias!" }).returning(),
      );
      await expectPgError(
        h.as(h.claimsFor(friend), (tx) =>
          tx.insert(responses).values({ storyId: story.id, authorId: friend, parentId: reply!.id, body: "Demasiado profundo" }),
        ),
        PG.checkViolation,
      );

      expect((await notificationsFor(h, writer)).map((n) => n.type)).toEqual(["response"]);
      expect((await notificationsFor(h, reader)).map((n) => n.type)).toEqual(["reply"]);
      expect(await notificationsFor(h, friend)).toEqual([expect.objectContaining({ type: "mention", responseId: top!.id })]);
    });
  });

  it("only go on live stories, can't be pinned or moved by their author, and soft-delete", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const other = await h.createUser();
      const story = await makeStory(h, writer);
      const draft = await makeStory(h, writer, { status: "draft", publishedAt: null });

      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(responses).values({ storyId: draft.id, authorId: reader, body: "Hola" })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) =>
          tx.insert(responses).values({ storyId: story.id, authorId: reader, body: "Fijada", pinnedAt: new Date() }),
        ),
        PG.insufficientPrivilege,
      );

      const [mine] = await h.as(h.claimsFor(reader), (tx) =>
        tx.insert(responses).values({ storyId: story.id, authorId: reader, body: "Mía" }).returning(),
      );
      const edited = await h.as(h.claimsFor(other), (tx) =>
        tx.update(responses).set({ body: "Hackeada" }).where(eq(responses.id, mine!.id)).returning({ id: responses.id }),
      );
      expect(edited).toHaveLength(0);
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.update(responses).set({ storyId: draft.id }).where(eq(responses.id, mine!.id))),
        PG.insufficientPrivilege,
      );

      await h.as(h.claimsFor(reader), (tx) => tx.update(responses).set({ deletedAt: new Date() }).where(eq(responses.id, mine!.id)));
      const visible = await h.as(null, (tx) => tx.select().from(responses).where(eq(responses.storyId, story.id)));
      expect(visible).toHaveLength(0);
    });
  });

  it("can be pinned only by the story's writer", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      const [response] = await h.tx.insert(responses).values({ storyId: story.id, authorId: reader, body: "Hola" }).returning();

      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.execute(sql`select public.set_response_pinned(${response!.id}, true)`)),
        PG.insufficientPrivilege,
      );
      await h.as(h.claimsFor(writer), (tx) => tx.execute(sql`select public.set_response_pinned(${response!.id}, true)`));
      const [pinned] = await h.tx.select({ pinnedAt: responses.pinnedAt }).from(responses).where(eq(responses.id, response!.id));
      expect(pinned?.pinnedAt).toBeInstanceOf(Date);
    });
  });

  it("take one spark per reader, never from their own author", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      const [response] = await h.tx.insert(responses).values({ storyId: story.id, authorId: reader, body: "Hola" }).returning();

      await h.as(h.claimsFor(writer), (tx) => tx.insert(responseSparks).values({ userId: writer, responseId: response!.id }));
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(responseSparks).values({ userId: writer, responseId: response!.id })),
        PG.uniqueViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(responseSparks).values({ userId: reader, responseId: response!.id })),
        PG.insufficientPrivilege,
      );
      const notices = await notificationsFor(h, reader);
      expect(notices).toEqual([expect.objectContaining({ type: "spark", responseId: response!.id })]);
    });
  });
});

describe("notifications", () => {
  it("are visible only to their recipient, who can only mark them read", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await makeStory(h, writer);
      await h.tx.insert(sparks).values({ userId: reader, storyId: story.id });
      const [notice] = await notificationsFor(h, writer);

      const peek = await h.as(h.claimsFor(reader), (tx) => tx.select().from(notifications).where(eq(notifications.userId, writer)));
      expect(peek).toHaveLength(0);
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.update(notifications).set({ actorCount: 99 }).where(eq(notifications.id, notice!.id))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) =>
          tx.insert(notifications).values({ userId: writer, type: "spark", actorIds: [reader] }),
        ),
        PG.insufficientPrivilege,
      );
      const read = await h.as(h.claimsFor(writer), (tx) =>
        tx.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, notice!.id)).returning({ id: notifications.id }),
      );
      expect(read).toHaveLength(1);
    });
  });

  it("start a new group once the previous one has been read", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const first = await h.createUser();
      const second = await h.createUser();
      const story = await makeStory(h, writer);
      await h.tx.insert(sparks).values({ userId: first, storyId: story.id });
      await h.tx.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, writer));
      await h.tx.insert(sparks).values({ userId: second, storyId: story.id });

      const notices = await h.tx
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, writer), eq(notifications.type, "spark")));
      expect(notices).toHaveLength(2);
      expect(notices.find((n) => n.readAt === null)?.actorIds).toEqual([second]);
    });
  });
});
