import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { follows, profiles, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario } from "./harness";

afterAll(closeDb);

describe("deleting an account", () => {
  it("removes the person and everything tied to them, and only them", async () => {
    await scenario(async (h) => {
      const leaving = await h.createUser();
      const staying = await h.createUser();
      await h.tx.insert(stories).values({ authorId: leaving, title: "Adiós", slug: `adios-${Date.now()}`, language: "es" });
      await h.tx.insert(follows).values({ followerId: staying, followedUserId: leaving });

      await h.as(h.claimsFor(leaving), (tx) => tx.execute(sql`select public.delete_own_account()`));

      expect(await h.tx.select().from(profiles).where(eq(profiles.id, leaving))).toHaveLength(0);
      expect(await h.tx.select().from(stories).where(eq(stories.authorId, leaving))).toHaveLength(0);
      expect(await h.tx.select().from(follows).where(eq(follows.followerId, staying))).toHaveLength(0);
      const [auth] = await h.tx.execute<{ n: number }>(sql`select count(*)::int as n from auth.users where id = ${leaving}`);
      expect(auth?.n).toBe(0);
      // The other person is untouched.
      expect(await h.tx.select().from(profiles).where(eq(profiles.id, staying))).toHaveLength(1);
    });
  });

  it("can't be done signed out", async () => {
    await scenario(async (h) => {
      await expectPgError(h.as(null, (tx) => tx.execute(sql`select public.delete_own_account()`)), PG.insufficientPrivilege);
    });
  });
});
