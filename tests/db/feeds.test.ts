import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { profiles, sparks, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

async function liveStory(h: Harness, authorId: string, extra: Partial<typeof stories.$inferInsert> = {}) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Brasas",
      slug: `brasas-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: "published",
      publishedAt: sql`now() - interval '1 hour'` as unknown as Date,
      ...extra,
    })
    .returning({ id: stories.id });
  return row!.id;
}

const record = (h: Harness, story: string, viewer: string, ratio: number, seconds: number, reader: string | null = null) =>
  h.as(null, (tx) =>
    tx.execute<{ ok: boolean }>(sql`select public.record_read(${story}::uuid, ${viewer}, ${ratio}::real, ${seconds}, ${reader}::uuid) as ok`),
  ).then((rows) => rows[0]?.ok);

const heatOf = async (h: Harness, story: string) =>
  (await h.as(null, (tx) => tx.execute<{ heat: number }>(sql`select heat from public.story_heat() where story_id = ${story}`)))[0]?.heat ?? 0;

describe("reads", () => {
  it("record one row per reader and day, keeping the furthest point, for live stories only", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const story = await liveStory(h, writer);
      const draft = await liveStory(h, writer, { status: "draft", publishedAt: null, slug: `draft-${Date.now()}` });
      const viewer = "a".repeat(40);

      expect(await record(h, story, viewer, 0.3, 40)).toBe(true);
      expect(await record(h, story, viewer, 0.8, 20)).toBe(true);
      expect(await record(h, story, viewer, 0.5, 90)).toBe(true);
      const rows = await h.tx.execute<{ read_ratio: number; seconds: number }>(
        sql`select read_ratio, seconds from public.read_events where story_id = ${story}`,
      );
      expect(rows.map((row) => [Number(row.read_ratio.toFixed(2)), row.seconds])).toEqual([[0.8, 90]]);

      // Drafts and the writer's own reads don't count.
      expect(await record(h, draft, viewer, 1, 10)).toBe(false);
      expect(await record(h, story, "b".repeat(40), 1, 10, writer)).toBe(false);
    });
  });

  it("stay private, and the daily job forgets reads after 13 months", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const story = await liveStory(h, writer);
      await record(h, story, "c".repeat(40), 1, 60);
      await expectPgError(h.as(h.claimsFor(writer), (tx) => tx.execute(sql`select * from public.read_events`)), PG.insufficientPrivilege);
      await expectPgError(
        h.as(null, (tx) => tx.execute(sql`insert into public.read_events (story_id, viewer_hash, read_ratio) values (${story}, ${"d".repeat(40)}, 1)`)),
        PG.insufficientPrivilege,
      );
      await expectPgError(h.as(h.claimsFor(writer), (tx) => tx.execute(sql`select public.prune_read_events()`)), PG.insufficientPrivilege);
      await h.tx.execute(sql`update public.read_events set day = day - interval '14 months' where story_id = ${story}`);
      const [pruned] = await h.tx.execute<{ n: number }>(sql`select public.prune_read_events() as n`);
      expect(pruned?.n).toBe(1);
    });
  });
});

describe("Burning now", () => {
  it("adds up recent activity, fading with time, and ignores the writer's own replies", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const reader = await h.createUser();
      const story = await liveStory(h, writer);
      expect(await heatOf(h, story)).toBe(0);

      await h.tx.insert(sparks).values({ userId: reader, storyId: story, count: 50 });
      const fresh = await heatOf(h, story);
      expect(fresh).toBeCloseTo(4, 1); // 2 for the sparker + 2 for fifty sparks

      await h.tx.execute(sql`insert into public.responses (story_id, author_id, body) values (${story}, ${writer}, 'Gracias')`);
      expect(await heatOf(h, story)).toBeCloseTo(fresh, 5);

      await record(h, story, "e".repeat(40), 0.9, 120);
      expect(await heatOf(h, story)).toBeCloseTo(fresh + 1, 1);

      // The same sparks a day and a half ago burn half as much (inserted past-dated: an update
      // would re-stamp updated_at).
      const older = await liveStory(h, writer);
      await h.tx.insert(sparks).values({ userId: reader, storyId: older, count: 50, updatedAt: sql`now() - interval '36 hours'` as unknown as Date });
      expect(await heatOf(h, older)).toBeCloseTo(fresh / 2, 1);
    });
  });
});

describe("onboarding", () => {
  it("starts new accounts un-onboarded, reading both languages, and lets them change both", async () => {
    await scenario(async (h) => {
      const id = await h.createUser();
      const [fresh] = await h.tx.select({ onboardedAt: profiles.onboardedAt, readingLanguages: profiles.readingLanguages }).from(profiles).where(eq(profiles.id, id));
      expect(fresh).toEqual({ onboardedAt: null, readingLanguages: ["es", "en"] });

      await h.as(h.claimsFor(id), (tx) =>
        tx.update(profiles).set({ onboardedAt: new Date(), readingLanguages: ["en"] }).where(eq(profiles.id, id)),
      );
      const [after] = await h.tx.select({ onboardedAt: profiles.onboardedAt, readingLanguages: profiles.readingLanguages }).from(profiles).where(eq(profiles.id, id));
      expect(after?.onboardedAt).not.toBeNull();
      expect(after?.readingLanguages).toEqual(["en"]);

      await expectPgError(
        h.savepoint((tx) => tx.update(profiles).set({ readingLanguages: [] }).where(eq(profiles.id, id))),
        PG.checkViolation,
      );
    });
  });
});
