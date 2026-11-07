import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { series, stories, storyVersions } from "@/lib/db/schema";
import type { TiptapDoc } from "@/lib/domain/content";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

async function story(h: Harness, authorId: string) {
  const [row] = await h.tx
    .insert(stories)
    .values({ authorId, title: "Noche", slug: `noche-${Math.random().toString(36).slice(2, 8)}`, language: "es" })
    .returning({ id: stories.id });
  return row!.id;
}

const doc: TiptapDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hola" }] }] };

describe("series", () => {
  it("are public to read, managed only by their writer, and hold only that writer's stories", async () => {
    await scenario(async (h) => {
      const ana = await h.createUser();
      const beto = await h.createUser();
      const [mine] = await h.as(h.claimsFor(ana), (tx) => tx.insert(series).values({ authorId: ana, title: "Río", slug: "rio" }).returning({ id: series.id }));
      expect(await h.as(null, (tx) => tx.select().from(series).where(eq(series.id, mine!.id)))).toHaveLength(1);

      await expectPgError(h.as(h.claimsFor(beto), (tx) => tx.insert(series).values({ authorId: ana, title: "Falsa", slug: "falsa" })), PG.insufficientPrivilege);
      await h.as(h.claimsFor(beto), (tx) => tx.update(series).set({ title: "Mía" }).where(eq(series.id, mine!.id)));
      await h.as(h.claimsFor(beto), (tx) => tx.delete(series).where(eq(series.id, mine!.id)));
      expect((await h.tx.select({ title: series.title }).from(series).where(eq(series.id, mine!.id)))[0]?.title).toBe("Río");

      // Beto can't put his story into Ana's series.
      const betos = await story(h, beto);
      await expectPgError(
        h.as(h.claimsFor(beto), (tx) => tx.update(stories).set({ seriesId: mine!.id, seriesPosition: 1 }).where(eq(stories.id, betos))),
        PG.insufficientPrivilege,
      );

      // Ana can; deleting the series leaves the story, ungrouped.
      const anas = await story(h, ana);
      await h.as(h.claimsFor(ana), (tx) => tx.update(stories).set({ seriesId: mine!.id, seriesPosition: 1 }).where(eq(stories.id, anas)));
      await h.as(h.claimsFor(ana), (tx) => tx.delete(series).where(eq(series.id, mine!.id)));
      const [after] = await h.tx.select({ seriesId: stories.seriesId, seriesPosition: stories.seriesPosition }).from(stories).where(eq(stories.id, anas));
      expect(after).toEqual({ seriesId: null, seriesPosition: null });
    });
  });
});

describe("version history", () => {
  it("is the writer's alone and keeps the newest 50", async () => {
    await scenario(async (h) => {
      const ana = await h.createUser();
      const beto = await h.createUser();
      const anas = await story(h, ana);
      await h.as(h.claimsFor(ana), (tx) => tx.insert(storyVersions).values({ storyId: anas, kind: "draft", content: doc }));
      expect(await h.as(h.claimsFor(ana), (tx) => tx.select().from(storyVersions))).toHaveLength(1);
      expect(await h.as(h.claimsFor(beto), (tx) => tx.select().from(storyVersions))).toHaveLength(0);
      await expectPgError(h.as(null, (tx) => tx.select().from(storyVersions)), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(beto), (tx) => tx.insert(storyVersions).values({ storyId: anas, kind: "draft", content: doc })), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(ana), (tx) => tx.delete(storyVersions)), PG.insufficientPrivilege);

      for (let n = 0; n < 55; n += 1) {
        await h.tx.insert(storyVersions).values({ storyId: anas, kind: "draft", content: doc, createdAt: sql`now() + make_interval(secs => ${n + 1})` as unknown as Date });
      }
      expect(await h.tx.select().from(storyVersions).where(eq(storyVersions.storyId, anas))).toHaveLength(50);
    });
  });
});
