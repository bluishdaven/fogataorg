import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { highlights, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const BLOCK = "45d99772-cde7-4b17-acc9-49f4321693ae";

async function story(h: Harness, authorId: string, live = true) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Garza",
      slug: `garza-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: live ? "published" : "draft",
      publishedAt: live ? (sql`now() - interval '1 hour'` as unknown as Date) : null,
    })
    .returning({ id: stories.id });
  return row!.id;
}

const ember = (userId: string, storyId: string, start = 0) => ({ userId, storyId, blockId: BLOCK, startOffset: start, endOffset: start + 5, quote: "garza" });

describe("embers", () => {
  it("are private to the reader who kept them, and only on live stories", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const other = await h.createUser();
      const live = await story(h, writer);
      const draft = await story(h, writer, false);

      await h.as(h.claimsFor(reader), (tx) => tx.insert(highlights).values(ember(reader, live)));
      expect(await h.as(h.claimsFor(reader), (tx) => tx.select().from(highlights))).toHaveLength(1);
      expect(await h.as(h.claimsFor(other), (tx) => tx.select().from(highlights))).toHaveLength(0);
      expect(await h.as(h.claimsFor(writer), (tx) => tx.select().from(highlights))).toHaveLength(0);
      await expectPgError(h.as(null, (tx) => tx.select().from(highlights)), PG.insufficientPrivilege);

      // Not on drafts, not in someone else's name, never edited.
      await expectPgError(h.as(h.claimsFor(reader), (tx) => tx.insert(highlights).values(ember(reader, draft))), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(other), (tx) => tx.insert(highlights).values(ember(reader, live, 10))), PG.insufficientPrivilege);
      await expectPgError(
        h.as(h.claimsFor(reader), (tx) => tx.update(highlights).set({ quote: "otra" }).where(eq(highlights.userId, reader))),
        PG.insufficientPrivilege,
      );

      // Others can't remove it; the reader can.
      await h.as(h.claimsFor(other), (tx) => tx.delete(highlights));
      expect(await h.tx.select().from(highlights).where(eq(highlights.userId, reader))).toHaveLength(1);
      await h.as(h.claimsFor(reader), (tx) => tx.delete(highlights).where(eq(highlights.userId, reader)));
      expect(await h.tx.select().from(highlights).where(eq(highlights.userId, reader))).toHaveLength(0);
    });
  });

  it("warm a story once per reader, however many passages they keep", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const live = await story(h, writer);
      await h.tx.insert(highlights).values([ember(reader, live, 0), ember(reader, live, 20), ember(reader, live, 40)]);
      const [row] = await h.tx.execute<{ heat: number }>(sql`select heat from public.story_heat() where story_id = ${live}`);
      expect(row?.heat).toBeCloseTo(2, 1);
    });
  });
});
