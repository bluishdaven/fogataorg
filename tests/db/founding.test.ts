import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { notifications, profiles, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

async function publish(h: Harness, authorId: string, count: number) {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const [row] = await h.tx
      .insert(stories)
      .values({
        authorId,
        title: `Leña ${index}`,
        slug: `lena-${index}-${Math.random().toString(36).slice(2, 8)}`,
        language: "es",
        status: "published",
        publishedAt: sql`now() - interval '1 hour'` as unknown as Date,
      })
      .returning({ id: stories.id });
    ids.push(row!.id);
  }
  return ids;
}

const numberOf = async (h: Harness, id: string) =>
  (await h.tx.select({ n: profiles.foundingNumber }).from(profiles).where(eq(profiles.id, id)))[0]?.n ?? null;

describe("founding writers", () => {
  it("are the first 100 to publish five stories, numbered in order, told once and kept for good", async () => {
    await scenario(async (h) => {
      // Start from a known count, whatever the seeded database holds.
      await h.tx.update(profiles).set({ foundingNumber: null });
      const [first, second, almost] = [await h.createUser(), await h.createUser(), await h.createUser()];

      const firstStories = await publish(h, first, 5);
      await publish(h, almost, 4);
      await publish(h, second, 5);
      expect(await numberOf(h, first)).toBe(1);
      expect(await numberOf(h, second)).toBe(2);
      expect(await numberOf(h, almost)).toBeNull();

      const told = await h.tx.select().from(notifications).where(and(eq(notifications.userId, first), eq(notifications.type, "founding")));
      expect(told).toHaveLength(1);
      expect(told[0]!.badge).toBe("founding");

      // Unpublishing stories later doesn't take it away, and publishing more doesn't renumber.
      await h.tx.update(stories).set({ deletedAt: sql`now()` as unknown as Date }).where(eq(stories.id, firstStories[0]!));
      await publish(h, first, 2);
      expect(await numberOf(h, first)).toBe(1);

      // Writers can't give it to themselves.
      await expectPgError(
        h.as(h.claimsFor(almost), (tx) => tx.update(profiles).set({ foundingNumber: 3 }).where(eq(profiles.id, almost))),
        PG.insufficientPrivilege,
      );
    });
  });

  it("stop at 100", async () => {
    await scenario(async (h) => {
      await h.tx.update(profiles).set({ foundingNumber: null });
      const [hundredth, late] = [await h.createUser(), await h.createUser()];
      await h.tx.update(profiles).set({ foundingNumber: 100 }).where(eq(profiles.id, hundredth));
      await publish(h, late, 5);
      expect(await numberOf(h, late)).toBeNull();
      await expectPgError(h.savepoint((tx) => tx.update(profiles).set({ foundingNumber: 101 }).where(eq(profiles.id, late))), PG.checkViolation);
    });
  });
});
