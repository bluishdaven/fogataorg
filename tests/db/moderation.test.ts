import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { publishedCountSql } from "@/lib/data/badge-sql";
import { moderationLog, profiles, stories, storyModeration } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const HOUR = 60 * 60 * 1000;
const adminClaims = (h: Harness, id: string) => ({ ...h.claimsFor(id), app_metadata: { role: "admin" } });

async function publishedStory(h: Harness, authorId: string) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Una historia",
      slug: `m-${Math.random().toString(36).slice(2, 9)}`,
      language: "es",
      status: "published",
      publishedAt: new Date(Date.now() - HOUR),
    })
    .returning({ id: stories.id });
  return row!.id;
}

const moderate = (h: Harness, claims: Parameters<Harness["as"]>[0], story: string, status: "nsfw" | "removed" | null, reason = "") =>
  h.as(claims, (tx) => tx.execute(sql`select public.moderate_story(${story}::uuid, ${status}::public.moderation_status, ${reason})`));

describe("story moderation", () => {
  it("lets admins mark stories NSFW, remove them and lift it, with a public reason and a private log", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const writer = await h.createUser();
      const story = await publishedStory(h, writer);

      await moderate(h, adminClaims(h, admin), story, "nsfw", "  Graphic violence  ");
      let [row] = await h.as(null, (tx) => tx.select().from(storyModeration).where(eq(storyModeration.storyId, story)));
      expect(row).toMatchObject({ status: "nsfw", reason: "Graphic violence", moderatedBy: admin });

      await moderate(h, adminClaims(h, admin), story, "removed", "Spam");
      [row] = await h.as(null, (tx) => tx.select().from(storyModeration).where(eq(storyModeration.storyId, story)));
      expect(row).toMatchObject({ status: "removed", reason: "Spam" });

      await moderate(h, adminClaims(h, admin), story, null);
      expect(await h.tx.select().from(storyModeration).where(eq(storyModeration.storyId, story))).toHaveLength(0);

      const log = await h.as(adminClaims(h, admin), (tx) =>
        tx.select().from(moderationLog).where(eq(moderationLog.storyId, story)),
      );
      expect(log.map((entry) => entry.status).sort()).toEqual(["nsfw", "removed", null].sort());
      expect(await h.as(h.claimsFor(writer), (tx) => tx.select().from(moderationLog))).toHaveLength(0);
    });
  });

  it("requires a reason to mark or remove", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const story = await publishedStory(h, await h.createUser());
      await expectPgError(moderate(h, adminClaims(h, admin), story, "removed", "   "), "22023");
    });
  });

  it("can't be done, or undone, by anyone else", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const writer = await h.createUser();
      const story = await publishedStory(h, writer);
      await expectPgError(moderate(h, h.claimsFor(writer), story, "nsfw", "nope"), PG.insufficientPrivilege);
      await expectPgError(moderate(h, null, story, "nsfw", "nope"), PG.insufficientPrivilege);

      await moderate(h, adminClaims(h, admin), story, "removed", "Spam");
      // The writer can't lift it by writing to the table directly.
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.delete(storyModeration).where(eq(storyModeration.storyId, story))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.update(storyModeration).set({ reason: "fine" }).where(eq(storyModeration.storyId, story))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(storyModeration).values({ storyId: story, status: "nsfw", reason: "x" })),
        PG.insufficientPrivilege,
      );
      const [still] = await h.tx.select().from(storyModeration).where(eq(storyModeration.storyId, story));
      expect(still?.status).toBe("removed");
    });
  });

  it("takes removed stories out of the writer's tier count", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const writer = await h.createUser();
      const kept = await publishedStory(h, writer);
      const removed = await publishedStory(h, writer);
      const nsfw = await publishedStory(h, writer);
      await moderate(h, adminClaims(h, admin), removed, "removed", "Spam");
      await moderate(h, adminClaims(h, admin), nsfw, "nsfw", "Explicit");
      const [row] = await h.as(null, (tx) =>
        tx.select({ count: publishedCountSql() }).from(profiles).where(eq(profiles.id, writer)),
      );
      expect(row?.count).toBe(2);
      expect(kept).toBeTruthy();
    });
  });
});
