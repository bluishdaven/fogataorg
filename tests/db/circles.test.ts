import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { circleMembers, circles, circleSubmissions, follows, notifications, stories } from "@/lib/db/schema";
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

async function makeCircle(h: Harness, ownerId: string, slug = `circulo-${Math.random().toString(36).slice(2, 8)}`) {
  const [row] = await h.as(h.claimsFor(ownerId), (tx) =>
    tx.insert(circles).values({ ownerId, slug, name: "Círculo de prueba", accentColor: "#1d4ed8" }).returning(),
  );
  return row!;
}

describe("circles", () => {
  it("make their creator the owner and only let editors change presentation", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const stranger = await h.createUser();
      const circle = await makeCircle(h, owner);

      const members = await h.tx.select().from(circleMembers).where(eq(circleMembers.circleId, circle.id));
      expect(members).toEqual([expect.objectContaining({ userId: owner, role: "owner" })]);

      const byStranger = await h.as(h.claimsFor(stranger), (tx) =>
        tx.update(circles).set({ name: "Robado" }).where(eq(circles.id, circle.id)).returning({ id: circles.id }),
      );
      expect(byStranger).toHaveLength(0);
      const byOwner = await h.as(h.claimsFor(owner), (tx) =>
        tx.update(circles).set({ name: "Renombrado", accentColor: "#0f766e" }).where(eq(circles.id, circle.id)).returning({ id: circles.id }),
      );
      expect(byOwner).toHaveLength(1);
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) => tx.update(circles).set({ slug: "otro-slug" }).where(eq(circles.id, circle.id))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) => tx.update(circles).set({ accentColor: "red" }).where(eq(circles.id, circle.id))),
        PG.checkViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(stranger), (tx) => tx.insert(circles).values({ ownerId: owner, slug: "ajeno", name: "Ajeno" })),
        PG.insufficientPrivilege,
      );
    });
  });

  it("have case-insensitive unique slugs", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      await makeCircle(h, owner, "lectores");
      await expectPgError(
        h.savepoint((tx) => tx.insert(circles).values({ ownerId: owner, slug: "lectores", name: "Otro" })),
        PG.uniqueViolation,
      );
    });
  });
});

describe("circle members", () => {
  it("are added and removed by the owner; editors can't add people or a second owner", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const editor = await h.createUser();
      const other = await h.createUser();
      const circle = await makeCircle(h, owner);

      await h.as(h.claimsFor(owner), (tx) => tx.insert(circleMembers).values({ circleId: circle.id, userId: editor, role: "editor" }));
      await expectPgError(
        h.as(h.claimsFor(editor), (tx) => tx.insert(circleMembers).values({ circleId: circle.id, userId: other, role: "editor" })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) => tx.insert(circleMembers).values({ circleId: circle.id, userId: other, role: "owner" })),
        PG.insufficientPrivilege,
      );

      // The owner can't be removed, even by themselves; editors can leave.
      const removeOwner = await h.as(h.claimsFor(owner), (tx) =>
        tx.delete(circleMembers).where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, owner))).returning({ id: circleMembers.id }),
      );
      expect(removeOwner).toHaveLength(0);
      const leave = await h.as(h.claimsFor(editor), (tx) =>
        tx.delete(circleMembers).where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, editor))).returning({ id: circleMembers.id }),
      );
      expect(leave).toHaveLength(1);
    });
  });
});

describe("circle submissions", () => {
  it("wait for an editor, notify editors, and tell the writer the decision", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const editor = await h.createUser();
      const writer = await h.createUser();
      const circle = await makeCircle(h, owner);
      await h.tx.insert(circleMembers).values({ circleId: circle.id, userId: editor, role: "editor" });
      const story = await makeStory(h, writer);

      const [submission] = await h.as(h.claimsFor(writer), (tx) =>
        tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: writer }).returning(),
      );
      expect(submission?.status).toBe("pending");

      for (const id of [owner, editor]) {
        const [notice] = await h.tx.select().from(notifications).where(eq(notifications.userId, id));
        expect(notice).toMatchObject({ type: "submission", storyId: story.id, circleId: circle.id });
      }

      // Pending submissions are private to the writer and the circle's editors.
      const publicView = await h.as(null, (tx) => tx.select().from(circleSubmissions).where(eq(circleSubmissions.id, submission!.id)));
      expect(publicView).toHaveLength(0);

      // The writer can't approve themselves.
      const selfApprove = await h.as(h.claimsFor(writer), (tx) =>
        tx.update(circleSubmissions).set({ status: "accepted" }).where(eq(circleSubmissions.id, submission!.id)).returning({ id: circleSubmissions.id }),
      );
      expect(selfApprove).toHaveLength(0);

      const [decided] = await h.as(h.claimsFor(editor), (tx) =>
        tx.update(circleSubmissions).set({ status: "accepted" }).where(eq(circleSubmissions.id, submission!.id)).returning(),
      );
      expect(decided).toMatchObject({ status: "accepted", decidedBy: editor });
      expect(decided?.decidedAt).toBeInstanceOf(Date);

      const [notice] = await h.tx.select().from(notifications).where(eq(notifications.userId, writer));
      expect(notice).toMatchObject({ type: "accepted", circleId: circle.id, actorIds: [editor] });

      const nowPublic = await h.as(null, (tx) => tx.select().from(circleSubmissions).where(eq(circleSubmissions.id, submission!.id)));
      expect(nowPublic).toHaveLength(1);
    });
  });

  it("skip review for members, allow one active circle per story, and only take the author's live stories", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const writer = await h.createUser();
      const stranger = await h.createUser();
      const circle = await makeCircle(h, owner);
      const other = await makeCircle(h, owner);
      await h.tx.insert(circleMembers).values({ circleId: circle.id, userId: writer, role: "writer" });
      const story = await makeStory(h, writer);
      const draft = await makeStory(h, writer, { status: "draft", publishedAt: null });

      await h.as(h.claimsFor(writer), (tx) => tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: writer }));
      const [row] = await h.tx.select().from(circleSubmissions).where(eq(circleSubmissions.storyId, story.id));
      expect(row?.status).toBe("accepted");

      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(circleSubmissions).values({ circleId: other.id, storyId: story.id, submittedBy: writer })),
        PG.uniqueViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: draft.id, submittedBy: writer })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(stranger), (tx) => tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: stranger })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) =>
          tx.insert(circleSubmissions).values({ circleId: other.id, storyId: draft.id, submittedBy: writer, status: "accepted" }),
        ),
        PG.insufficientPrivilege,
      );
    });
  });

  it("can be withdrawn by the writer or removed by an editor", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const writer = await h.createUser();
      const stranger = await h.createUser();
      const circle = await makeCircle(h, owner);
      const story = await makeStory(h, writer);
      await h.tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: writer });

      const byStranger = await h.as(h.claimsFor(stranger), (tx) =>
        tx.delete(circleSubmissions).where(eq(circleSubmissions.storyId, story.id)).returning({ id: circleSubmissions.id }),
      );
      expect(byStranger).toHaveLength(0);
      const byWriter = await h.as(h.claimsFor(writer), (tx) =>
        tx.delete(circleSubmissions).where(eq(circleSubmissions.storyId, story.id)).returning({ id: circleSubmissions.id }),
      );
      expect(byWriter).toHaveLength(1);
    });
  });
});

describe("following circles", () => {
  it("uses the same follows table with exactly one target", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const reader = await h.createUser();
      const circle = await makeCircle(h, owner);
      await h.as(h.claimsFor(reader), (tx) => tx.insert(follows).values({ followerId: reader, followedCircleId: circle.id }));
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(follows).values({ followerId: reader, followedCircleId: circle.id, followedUserId: owner })),
        PG.checkViolation,
      );
    });
  });
});
