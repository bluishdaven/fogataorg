import { and, eq, notInArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { circleJoinRequests, circleMembers, circles, circleSubmissions, follows, notifications, stories } from "@/lib/db/schema";
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

async function makeCircle(h: Harness, ownerId: string, slug = `circulo-${Math.random().toString(36).slice(2, 8)}`, isPrivate = false) {
  const [row] = await h.as(h.claimsFor(ownerId), (tx) =>
    tx.insert(circles).values({ ownerId, slug, name: "Círculo de prueba", accentColor: "#1d4ed8", isPrivate }).returning(),
  );
  return row!;
}

const privateCircle = (h: Harness, ownerId: string) => makeCircle(h, ownerId, undefined, true);

function decide(h: Harness, userId: string, requestId: string, accept: boolean) {
  return h.as(h.claimsFor(userId), (tx) =>
    tx.execute<{ slug: string }>(sql`select public.decide_join_request(${requestId}::uuid, ${accept}) as slug`),
  );
}

async function noticesFor(h: Harness, userId: string) {
  return h.tx
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), notInArray(notifications.type, ["badge", "donor"])));
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

      const [notice] = await h.tx
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, writer), notInArray(notifications.type, ["badge", "donor"])));
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

describe("decline notes", () => {
  it("are written by editors on declined submissions only and cleared if the decision changes", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const writer = await h.createUser();
      const circle = await makeCircle(h, owner);
      const story = await makeStory(h, writer);
      const [submission] = await h.as(h.claimsFor(writer), (tx) =>
        tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: writer }).returning(),
      );
      const update = (userId: string, values: Partial<typeof circleSubmissions.$inferInsert>) =>
        h.as(h.claimsFor(userId), (tx) => tx.update(circleSubmissions).set(values).where(eq(circleSubmissions.id, submission!.id)).returning());

      // Dropped on a pending submission, and never written by the writer.
      const [pending] = await update(owner, { declineNote: "Todavía no." });
      expect(pending).toMatchObject({ status: "pending", declineNote: null });
      expect(await update(writer, { status: "declined", declineNote: "Me rechazo." })).toHaveLength(0);

      const [declined] = await update(owner, { status: "declined", declineNote: "  Muy bonita, pero no es para este círculo.  " });
      expect(declined).toMatchObject({ status: "declined", declineNote: "Muy bonita, pero no es para este círculo." });
      const [blank] = await update(owner, { declineNote: "   " });
      expect(blank!.declineNote).toBeNull();
      await expectPgError(update(owner, { declineNote: "x".repeat(501) }), PG.checkViolation);

      await update(owner, { declineNote: "Inténtalo con otra." });
      const [accepted] = await update(owner, { status: "accepted" });
      expect(accepted!.declineNote).toBeNull();
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

describe("private circles", () => {
  it("take stories only from members; everyone else asks to join and an editor lets them in", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const editor = await h.createUser();
      const reader = await h.createUser();
      const bystander = await h.createUser();
      const circle = await privateCircle(h, owner);
      await h.tx.insert(circleMembers).values({ circleId: circle.id, userId: editor, role: "editor" });
      const story = await makeStory(h, reader);

      // Still listed and readable by anyone.
      const listed = await h.as(null, (tx) => tx.select({ isPrivate: circles.isPrivate }).from(circles).where(eq(circles.id, circle.id)));
      expect(listed).toEqual([{ isPrivate: true }]);

      // Not a member yet: no submissions.
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: reader })),
        PG.insufficientPrivilege,
      );

      const [request] = await h.as(h.claimsFor(reader), (tx) =>
        tx.insert(circleJoinRequests).values({ circleId: circle.id, userId: reader }).returning(),
      );
      expect(request?.status).toBe("pending");
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.insert(circleJoinRequests).values({ circleId: circle.id, userId: reader })),
        PG.uniqueViolation,
      );
      // Nobody can ask on someone else's behalf, or pre-decide their own request.
      await expectPgError(
        h.as(h.claimsFor(bystander), (tx) => tx.insert(circleJoinRequests).values({ circleId: circle.id, userId: owner })),
        PG.insufficientPrivilege,
      );

      // The owner and editors hear about it.
      for (const id of [owner, editor]) {
        const [notice] = await noticesFor(h, id);
        expect(notice).toMatchObject({ type: "join_request", circleId: circle.id, storyId: null, actorIds: [reader] });
      }

      // Requests are visible to the person and the circle's editors only.
      await expectPgError(h.as(null, (tx) => tx.select().from(circleJoinRequests)), PG.insufficientPrivilege);
      expect(await h.as(h.claimsFor(bystander), (tx) => tx.select().from(circleJoinRequests).where(eq(circleJoinRequests.circleId, circle.id)))).toHaveLength(0);
      expect(await h.as(h.claimsFor(editor), (tx) => tx.select().from(circleJoinRequests).where(eq(circleJoinRequests.circleId, circle.id)))).toHaveLength(1);

      // Only the owner and editors decide; nobody updates requests directly.
      await expectPgError(decide(h, reader, request!.id, true), PG.insufficientPrivilege);
      await expectPgError(decide(h, bystander, request!.id, true), PG.insufficientPrivilege);
      await expectPgError(
        h.as(h.claimsFor(editor), (tx) => tx.update(circleJoinRequests).set({ status: "declined" }).where(eq(circleJoinRequests.id, request!.id))),
        PG.insufficientPrivilege,
      );

      const [result] = await decide(h, editor, request!.id, true);
      expect(result?.slug).toBe(circle.slug);
      const [membership] = await h.tx
        .select({ role: circleMembers.role })
        .from(circleMembers)
        .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, reader)));
      expect(membership?.role).toBe("writer");
      expect(await h.tx.select().from(circleJoinRequests).where(eq(circleJoinRequests.id, request!.id))).toHaveLength(0);
      const [welcome] = await noticesFor(h, reader);
      expect(welcome).toMatchObject({ type: "join_accepted", circleId: circle.id, actorIds: [editor] });

      // Members publish straight in.
      const [submission] = await h.as(h.claimsFor(reader), (tx) =>
        tx.insert(circleSubmissions).values({ circleId: circle.id, storyId: story.id, submittedBy: reader }).returning({ id: circleSubmissions.id }),
      );
      const [after] = await h.tx.select({ status: circleSubmissions.status }).from(circleSubmissions).where(eq(circleSubmissions.id, submission!.id));
      expect(after?.status).toBe("accepted");
    });
  });

  it("can't be asked to join when public or already in; declined stays declined; pending can be withdrawn", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const writer = await h.createUser();
      const asker = await h.createUser();
      const quitter = await h.createUser();
      const added = await h.createUser();
      const open = await makeCircle(h, owner);
      const closed = await privateCircle(h, owner);
      await h.tx.insert(circleMembers).values({ circleId: closed.id, userId: writer, role: "writer" });

      await expectPgError(
        h.as(h.claimsFor(asker), (tx) => tx.insert(circleJoinRequests).values({ circleId: open.id, userId: asker })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(circleJoinRequests).values({ circleId: closed.id, userId: writer })),
        PG.insufficientPrivilege,
      );

      const [request] = await h.as(h.claimsFor(asker), (tx) =>
        tx.insert(circleJoinRequests).values({ circleId: closed.id, userId: asker }).returning(),
      );
      await decide(h, owner, request!.id, false);
      const [declined] = await h.tx.select().from(circleJoinRequests).where(eq(circleJoinRequests.id, request!.id));
      expect(declined).toMatchObject({ status: "declined", decidedBy: owner });
      expect(await noticesFor(h, asker)).toHaveLength(0);
      // No asking again, no deleting the record, no second decision.
      const withdrawn = await h.as(h.claimsFor(asker), (tx) =>
        tx.delete(circleJoinRequests).where(eq(circleJoinRequests.id, request!.id)).returning({ id: circleJoinRequests.id }),
      );
      expect(withdrawn).toHaveLength(0);
      await expectPgError(
        h.as(h.claimsFor(asker), (tx) => tx.insert(circleJoinRequests).values({ circleId: closed.id, userId: asker })),
        PG.uniqueViolation,
      );
      await expectPgError(decide(h, owner, request!.id, true), "55000");

      // A waiting request can be taken back.
      await h.as(h.claimsFor(quitter), (tx) => tx.insert(circleJoinRequests).values({ circleId: closed.id, userId: quitter }));
      const gone = await h.as(h.claimsFor(quitter), (tx) =>
        tx.delete(circleJoinRequests).where(eq(circleJoinRequests.userId, quitter)).returning({ id: circleJoinRequests.id }),
      );
      expect(gone).toHaveLength(1);

      // Adding someone by username clears whatever they had asked.
      await h.as(h.claimsFor(added), (tx) => tx.insert(circleJoinRequests).values({ circleId: closed.id, userId: added }));
      await h.as(h.claimsFor(owner), (tx) => tx.insert(circleMembers).values({ circleId: closed.id, userId: added, role: "writer" }));
      expect(await h.tx.select().from(circleJoinRequests).where(eq(circleJoinRequests.userId, added))).toHaveLength(0);
    });
  });

  it("group join requests per circle in the bell, and editors can switch a circle to private", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const editor = await h.createUser();
      const stranger = await h.createUser();
      const [ana, ben, cai] = [await h.createUser(), await h.createUser(), await h.createUser()];
      const first = await privateCircle(h, owner);
      const second = await privateCircle(h, owner);
      for (const [circleId, userId] of [
        [first.id, ana],
        [first.id, ben],
        [second.id, cai],
      ] as const) {
        await h.as(h.claimsFor(userId), (tx) => tx.insert(circleJoinRequests).values({ circleId, userId }));
      }
      const notices = await noticesFor(h, owner);
      expect(notices.map((n) => [n.circleId, n.actorCount]).sort()).toEqual(
        [
          [first.id, 2],
          [second.id, 1],
        ].sort(),
      );

      const open = await makeCircle(h, owner);
      await h.tx.insert(circleMembers).values({ circleId: open.id, userId: editor, role: "editor" });
      const byStranger = await h.as(h.claimsFor(stranger), (tx) =>
        tx.update(circles).set({ isPrivate: true }).where(eq(circles.id, open.id)).returning({ id: circles.id }),
      );
      expect(byStranger).toHaveLength(0);
      const byEditor = await h.as(h.claimsFor(editor), (tx) =>
        tx.update(circles).set({ isPrivate: true }).where(eq(circles.id, open.id)).returning({ isPrivate: circles.isPrivate }),
      );
      expect(byEditor).toEqual([{ isPrivate: true }]);
    });
  });
});
