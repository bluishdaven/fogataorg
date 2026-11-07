import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { circles, previousUsernames, profiles, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const rename = (h: Harness, id: string, username: string) =>
  h.as(h.claimsFor(id), (tx) => tx.update(profiles).set({ username }).where(eq(profiles.id, id)));

const usernameOf = async (h: Harness, id: string) =>
  (await h.tx.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, id)))[0]?.username;

describe("previous usernames", () => {
  it("remember old names for redirects and keep them for their owner", async () => {
    await scenario(async (h) => {
      const ana = await h.createUser({ metadata: { username: "Ana_Old" } });
      const other = await h.createUser();
      await rename(h, ana, "ana_new");

      // Anyone can read where an old name went (the proxy reads it as anon).
      const moved = await h.as(null, (tx) => tx.select().from(previousUsernames).where(eq(previousUsernames.username, "ana_old")));
      expect(moved.map((row) => row.profileId)).toEqual([ana]);

      // Nobody else can take it, by renaming or by signing up with it.
      await expectPgError(h.savepoint((tx) => rename({ ...h, tx } as Harness, other, "ANA_OLD")), PG.uniqueViolation);
      const newcomer = await h.createUser({ metadata: { username: "ana_old" } });
      expect(await usernameOf(h, newcomer)).toMatch(/^ana_old_\d{4}$/);

      // The owner can take it back, and it stops redirecting.
      await rename(h, ana, "Ana_Old");
      const left = await h.tx.select({ username: previousUsernames.username }).from(previousUsernames).where(eq(previousUsernames.profileId, ana));
      expect(left.map((row) => row.username)).toEqual(["ana_new"]);

      // Changing only the case isn't a new name.
      await rename(h, ana, "ana_old");
      expect((await h.tx.select().from(previousUsernames).where(eq(previousUsernames.profileId, ana))).length).toBe(1);

      // Nobody writes the list directly.
      await expectPgError(
        h.as(h.claimsFor(other), (tx) => tx.insert(previousUsernames).values({ username: "squat", profileId: other })),
        PG.insufficientPrivilege,
      );
    });
  });

  it("keep only the newest five and go away with the account", async () => {
    await scenario(async (h) => {
      const id = await h.createUser({ metadata: { username: "name_0" } });
      for (let n = 1; n <= 7; n += 1) {
        await rename(h, id, `name_${n}`);
        // changed_at is now() for the whole transaction; space them out so "newest" is defined.
        await h.tx.execute(sql`update public.previous_usernames set changed_at = changed_at - interval '1 minute'`);
      }
      const kept = await h.tx.select({ username: previousUsernames.username }).from(previousUsernames).where(eq(previousUsernames.profileId, id));
      expect(kept.map((row) => row.username).sort()).toEqual(["name_2", "name_3", "name_4", "name_5", "name_6"]);

      await h.tx.execute(sql`delete from auth.users where id = ${id}`);
      expect(await h.tx.select().from(previousUsernames).where(eq(previousUsernames.profileId, id))).toEqual([]);
    });
  });
});

describe("orphaned uploads", () => {
  it("list old files that nothing live points to", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const base = "http://127.0.0.1:54321/storage/v1/object/public";
      const file = (ext = "webp") => `${writer}/${randomUUID()}.${ext}`;
      const [inStory, inPending, cover, header, deletedStory, unused, fresh, photo, oldPhoto] = [
        file(), file("gif"), file(), file(), file(), file(), file(), file(), file(),
      ];
      for (const [bucket, name] of [
        ["story-images", inStory], ["story-images", inPending], ["story-images", cover], ["story-images", header],
        ["story-images", deletedStory], ["story-images", unused], ["avatars", photo], ["avatars", oldPhoto],
      ] as const) {
        await h.tx.execute(sql`insert into storage.objects (bucket_id, name, created_at) values (${bucket}, ${name}, now() - interval '3 days')`);
      }
      await h.tx.execute(sql`insert into storage.objects (bucket_id, name) values ('story-images', ${fresh})`);

      const figure = (name: string) => ({ type: "doc", content: [{ type: "figure", attrs: { src: `${base}/story-images/${name}` } }] });
      await h.tx.insert(stories).values([
        {
          authorId: writer, title: "Vive", slug: `vive-${Date.now()}`, language: "es",
          content: figure(inStory), coverUrl: `${base}/story-images/${cover}`,
          pendingChanges: { title: "Vive", subtitle: "", content: figure(inPending) },
        },
        { authorId: writer, title: "Borrada", slug: `borrada-${Date.now()}`, language: "es", content: figure(deletedStory), deletedAt: new Date() },
      ] as (typeof stories.$inferInsert)[]);
      await h.tx.insert(circles).values({ ownerId: writer, slug: `huerto-${Date.now()}`, name: "Huerto", headerUrl: `${base}/story-images/${header}` });
      await h.tx.update(profiles).set({ avatarUrl: `${base}/avatars/${photo}` }).where(eq(profiles.id, writer));

      const rows = await h.tx.execute<{ bucket: string; name: string }>(sql`select bucket, name from public.orphaned_uploads()`);
      const mine = rows.filter((row) => row.name.startsWith(writer)).map((row) => `${row.bucket}:${row.name}`).sort();
      expect(mine).toEqual([`avatars:${oldPhoto}`, `story-images:${deletedStory}`, `story-images:${unused}`].sort());

      await expectPgError(h.as(h.claimsFor(writer), (tx) => tx.execute(sql`select * from public.orphaned_uploads()`)), PG.insufficientPrivilege);
    });
  });
});
