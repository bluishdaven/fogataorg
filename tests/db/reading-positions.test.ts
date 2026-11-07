import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { readingPositions, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario } from "./harness";

afterAll(closeDb);

describe("reading positions", () => {
  it("are private to the reader and only for live stories", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const other = await h.createUser();
      const [live] = await h.tx
        .insert(stories)
        .values({ authorId: writer, title: "Río", slug: `rio-${Date.now()}`, language: "es", status: "published", publishedAt: sql`now() - interval '1 hour'` as unknown as Date })
        .returning({ id: stories.id });
      const [draft] = await h.tx.insert(stories).values({ authorId: writer, title: "Borrador", slug: `draft-${Date.now()}`, language: "es" }).returning({ id: stories.id });

      await h.as(h.claimsFor(reader), (tx) => tx.insert(readingPositions).values({ userId: reader, storyId: live!.id, progress: 0.4 }));
      expect(await h.as(h.claimsFor(reader), (tx) => tx.select().from(readingPositions))).toHaveLength(1);
      expect(await h.as(h.claimsFor(other), (tx) => tx.select().from(readingPositions))).toHaveLength(0);
      await expectPgError(h.as(null, (tx) => tx.select().from(readingPositions)), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(reader), (tx) => tx.insert(readingPositions).values({ userId: reader, storyId: draft!.id })), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(other), (tx) => tx.insert(readingPositions).values({ userId: reader, storyId: live!.id })), PG.insufficientPrivilege);

      await h.as(h.claimsFor(other), (tx) => tx.update(readingPositions).set({ progress: 0.9 }));
      expect((await h.tx.select({ progress: readingPositions.progress }).from(readingPositions).where(eq(readingPositions.userId, reader)))[0]?.progress).toBeCloseTo(0.4);
      await expectPgError(h.savepoint((tx) => tx.update(readingPositions).set({ progress: 2 }).where(eq(readingPositions.userId, reader))), PG.checkViolation);
    });
  });
});
