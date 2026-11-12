import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { bookmarks, follows, highlights, notifications, promptFeatures, prompts, sparks, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const BLOCK_A = "45d99772-cde7-4b17-acc9-49f4321693ae";
const BLOCK_B = "8d0c3c1e-5f47-4b8a-9d0a-0e2b8f3b6a11";

async function story(h: Harness, authorId: string, values: Partial<typeof stories.$inferInsert> = {}) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Brasas",
      slug: `brasas-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: "published",
      publishedAt: sql`now() - interval '1 day'` as unknown as Date,
      ...values,
    })
    .returning({ id: stories.id });
  return row!.id;
}

async function read(h: Harness, storyId: string, viewer: string, ratio: number, seconds: number, daysAgo = 0) {
  await h.tx.execute(sql`
    insert into public.read_events (story_id, viewer_hash, read_ratio, seconds, day)
    values (${storyId}, ${viewer.padEnd(20, "x")}, ${ratio}, ${seconds}, (now() at time zone 'utc')::date - ${daysAgo}::integer)
  `);
}

describe("writer stats", () => {
  it("count only the calling writer's stories, as totals", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const other = await h.createUser();
      const readerA = await h.createUser();
      const readerB = await h.createUser();
      const mine = await story(h, writer);
      const theirs = await story(h, other);

      await read(h, mine, "a", 0.9, 300);
      await read(h, mine, "b", 0.3, 20);
      await read(h, mine, "c", 0.6, 100, 3);
      await read(h, theirs, "d", 1, 500);
      await h.tx.insert(sparks).values([
        { userId: readerA, storyId: mine, count: 7 },
        { userId: readerB, storyId: mine, count: 3 },
      ]);
      await h.tx.insert(bookmarks).values({ userId: readerA, storyId: mine });
      await h.tx.insert(follows).values({ followerId: readerA, followedUserId: writer });

      const daily = await h.as(h.claimsFor(writer), (tx) =>
        tx.execute<{ day: string; views: number; reads: number; read_seconds: string }>(sql`select * from public.writer_daily_reads(7, null)`),
      );
      expect(daily).toHaveLength(7);
      const today = daily.at(-1)!;
      expect([today.views, today.reads, Number(today.read_seconds)]).toEqual([2, 1, 300]);
      expect(daily.reduce((sum, day) => sum + day.views, 0)).toBe(3);

      const [totals] = await h.as(h.claimsFor(writer), (tx) =>
        tx.execute<{ story_id: string; views: number; reads: number; avg_read_seconds: number; sparks: number; sparkers: number; saves: number }>(
          sql`select * from public.writer_story_totals()`,
        ),
      );
      expect(totals).toMatchObject({ story_id: mine, views: 3, reads: 2, avg_read_seconds: 200, sparks: 10, sparkers: 2, saves: 1 });

      // Someone else's story, or nobody signed in: nothing.
      const peek = await h.as(h.claimsFor(writer), (tx) => tx.execute<{ visitors: number }>(sql`select * from public.writer_read_depth(${theirs}::uuid)`));
      expect(peek[0]?.visitors).toBe(0);
      const depth = await h.as(h.claimsFor(writer), (tx) =>
        tx.execute<{ visitors: number; quarter: number; half: number; three_quarters: number; finished: number }>(
          sql`select * from public.writer_read_depth(${mine}::uuid)`,
        ),
      );
      expect(depth[0]).toEqual({ visitors: 3, quarter: 3, half: 2, three_quarters: 1, finished: 1 });
      await expectPgError(h.as(null, (tx) => tx.execute(sql`select * from public.writer_story_totals()`)), PG.insufficientPrivilege);
    });
  });

  it("show a paragraph as loved only once two readers kept it, never who", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const [a, b, c] = [await h.createUser(), await h.createUser(), await h.createUser()];
      const mine = await story(h, writer);
      const ember = (userId: string, blockId: string, start = 0) => ({ userId, storyId: mine, blockId, startOffset: start, endOffset: start + 4, quote: "humo" });
      await h.tx.insert(highlights).values([ember(a, BLOCK_A), ember(a, BLOCK_A, 9), ember(b, BLOCK_A), ember(c, BLOCK_B)]);

      const loved = await h.as(h.claimsFor(writer), (tx) => tx.execute<{ block_id: string; readers: number }>(sql`select * from public.writer_loved_passages(${mine}::uuid)`));
      expect(loved.map((row) => ({ ...row }))).toEqual([{ block_id: BLOCK_A, readers: 2 }]);
      const peek = await h.as(h.claimsFor(a), (tx) => tx.execute(sql`select * from public.writer_loved_passages(${mine}::uuid)`));
      expect(peek).toHaveLength(0);
    });
  });
});

describe("featured spark entries", () => {
  it("are set by admins on live entries of that spark, at most three, and tell the writer", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const writer = await h.createUser();
      const adminClaims = { ...h.claimsFor(admin), app_metadata: { role: "admin" } };
      const [week] = await h.tx.execute<{ monday: string }>(sql`select (date_trunc('week', now() at time zone 'utc')::date - 7)::text as monday`);
      await h.tx.delete(prompts).where(eq(prompts.weekOf, week!.monday));
      const [prompt] = await h.tx.insert(prompts).values({ weekOf: week!.monday, textEn: "Smoke", textEs: "Humo" }).returning({ id: prompts.id });
      const promptId = prompt!.id;
      const entries: string[] = [];
      for (let index = 0; index < 4; index += 1) entries.push(await story(h, writer, { promptId }));
      const unrelated = await story(h, writer);
      const draft = await story(h, writer, { promptId, status: "draft", publishedAt: null });

      // Readers can't feature; nobody can feature a story that isn't a live entry.
      await expectPgError(h.as(h.claimsFor(writer), (tx) => tx.insert(promptFeatures).values({ promptId, storyId: entries[0]! })), PG.insufficientPrivilege);
      await expectPgError(h.as(adminClaims, (tx) => tx.insert(promptFeatures).values({ promptId, storyId: unrelated })), PG.checkViolation);
      await expectPgError(h.as(adminClaims, (tx) => tx.insert(promptFeatures).values({ promptId, storyId: draft })), PG.checkViolation);

      await h.as(adminClaims, (tx) => tx.insert(promptFeatures).values(entries.slice(0, 3).map((storyId) => ({ promptId, storyId, featuredBy: writer }))));
      await expectPgError(h.as(adminClaims, (tx) => tx.insert(promptFeatures).values({ promptId, storyId: entries[3]! })), PG.checkViolation);

      // Everyone sees them; the admin is recorded whatever the insert said.
      const visible = await h.as(null, (tx) => tx.select({ storyId: promptFeatures.storyId, by: promptFeatures.featuredBy }).from(promptFeatures).where(eq(promptFeatures.promptId, promptId)));
      expect(visible).toHaveLength(3);
      expect(visible.every((row) => row.by === admin)).toBe(true);

      const notes = await h.tx.select().from(notifications).where(eq(notifications.userId, writer));
      expect(notes.filter((note) => note.type === "featured")).toHaveLength(3);
      expect(notes.every((note) => note.actorCount === 0)).toBe(true);

      // Taking one back removes its unread notification.
      await h.as(adminClaims, (tx) => tx.delete(promptFeatures).where(eq(promptFeatures.storyId, entries[0]!)));
      const after = await h.tx.select().from(notifications).where(eq(notifications.userId, writer));
      expect(after.filter((note) => note.type === "featured")).toHaveLength(2);
    });
  });
});
