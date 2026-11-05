import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { publishedCountSql } from "@/lib/data/badge-sql";
import { donorGrants, profiles, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const HOUR = 60 * 60 * 1000;

const adminClaims = (h: Harness, id: string) => ({ ...h.claimsFor(id), app_metadata: { role: "admin" } });

async function grant(h: Harness, claims: Parameters<Harness["as"]>[0], target: string, note = "") {
  return h.as(claims, async (tx) => {
    const [row] = await tx.execute<{ since: string }>(sql`select public.grant_donor_badge(${target}::uuid, ${note}) as since`);
    return row?.since ? new Date(row.since) : null;
  });
}

async function donorSince(h: Harness, id: string) {
  const [row] = await h.tx.select({ donorSince: profiles.donorSince }).from(profiles).where(eq(profiles.id, id));
  return row?.donorSince ?? null;
}

describe("donor badge", () => {
  it("is granted by admins, permanent, and keeps its first date", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const donor = await h.createUser();

      const first = await grant(h, adminClaims(h, owner), donor, "BMC 5 Nov");
      expect(first).not.toBeNull();
      expect((await donorSince(h, donor))?.getTime()).toBe(first?.getTime());

      // A later donation is logged but the badge keeps its original date.
      await h.tx.update(profiles).set({ donorSince: new Date(Date.now() - 30 * 24 * HOUR) }).where(eq(profiles.id, donor));
      const kept = await donorSince(h, donor);
      await grant(h, adminClaims(h, owner), donor, "BMC again");
      expect((await donorSince(h, donor))?.getTime()).toBe(kept?.getTime());

      const log = await h.tx.select().from(donorGrants).where(eq(donorGrants.userId, donor));
      expect(log.map((row) => row.note).sort()).toEqual(["BMC 5 Nov", "BMC again"]);
      expect(log.every((row) => row.grantedBy === owner)).toBe(true);
    });
  });

  it("can be removed by admins, and the log remembers", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const donor = await h.createUser();
      await grant(h, adminClaims(h, owner), donor);
      await h.as(adminClaims(h, owner), (tx) => tx.execute(sql`select public.remove_donor_badge(${donor}::uuid)`));
      expect(await donorSince(h, donor)).toBeNull();
      const [log] = await h.tx.select().from(donorGrants).where(eq(donorGrants.userId, donor));
      expect(log?.removedAt).not.toBeNull();
    });
  });

  it("can't be granted, removed or looked up by anyone else", async () => {
    await scenario(async (h) => {
      const someone = await h.createUser();
      const other = await h.createUser();
      await expectPgError(grant(h, h.claimsFor(someone), someone), PG.insufficientPrivilege);
      await expectPgError(grant(h, null, someone), PG.insufficientPrivilege);
      await expectPgError(
        h.as(h.claimsFor(someone), (tx) => tx.execute(sql`select public.remove_donor_badge(${other}::uuid)`)),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(someone), (tx) => tx.execute(sql`select * from public.admin_find_profile('anyone')`)),
        PG.insufficientPrivilege,
      );
      // Nor set directly: donor_since isn't an updatable column for users.
      await expectPgError(
        h.as(h.claimsFor(someone), (tx) =>
          tx.update(profiles).set({ donorSince: new Date() }).where(eq(profiles.id, someone)),
        ),
        PG.insufficientPrivilege,
      );
      expect(await donorSince(h, someone)).toBeNull();
    });
  });

  it("keeps its log private to admins", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const donor = await h.createUser();
      await grant(h, adminClaims(h, owner), donor, "private note");
      const asDonor = await h.as(h.claimsFor(donor), (tx) => tx.select().from(donorGrants));
      expect(asDonor).toHaveLength(0);
      const asOwner = await h.as(adminClaims(h, owner), (tx) => tx.select().from(donorGrants).where(eq(donorGrants.userId, donor)));
      expect(asOwner).toHaveLength(1);
      await expectPgError(h.as(null, (tx) => tx.select().from(donorGrants)), PG.insufficientPrivilege);
    });
  });

  it("lets admins find accounts by @username or sign-in email", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const donor = await h.createUser({ email: "Donor.Person@fogata.test" });
      const [profile] = await h.tx.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, donor));
      const find = (query: string) =>
        h.as(adminClaims(h, owner), (tx) => tx.execute<{ id: string }>(sql`select id from public.admin_find_profile(${query})`));
      expect((await find(`@${profile!.username.toUpperCase()}`))[0]?.id).toBe(donor);
      expect((await find("  donor.person@FOGATA.test ")).at(0)?.id).toBe(donor);
      expect(await find("nobody@fogata.test")).toHaveLength(0);
    });
  });
});

describe("writing tier count", () => {
  it("counts only published, public stories whose date has arrived", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const base = { authorId: writer, title: "T", language: "es" as const };
      const slug = () => `s-${Math.random().toString(36).slice(2, 9)}`;
      await h.tx.insert(stories).values([
        { ...base, slug: slug(), status: "published", publishedAt: new Date(Date.now() - HOUR) },
        { ...base, slug: slug(), status: "published", publishedAt: new Date(Date.now() - 2 * HOUR) },
        { ...base, slug: slug(), status: "draft" },
        { ...base, slug: slug(), status: "unlisted", publishedAt: new Date(Date.now() - HOUR) },
        { ...base, slug: slug(), status: "published", publishedAt: new Date(Date.now() + 24 * HOUR) },
        { ...base, slug: slug(), status: "published", publishedAt: new Date(Date.now() - HOUR), deletedAt: new Date() },
      ]);
      const [row] = await h.as(null, (tx) =>
        tx.select({ count: publishedCountSql() }).from(profiles).where(eq(profiles.id, writer)),
      );
      expect(row?.count).toBe(2);
    });
  });
});
