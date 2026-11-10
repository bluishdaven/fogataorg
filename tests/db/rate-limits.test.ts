import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, expectPgError, PG, scenario } from "./harness";

afterAll(closeDb);

describe("rate limits", () => {
  it("allow up to the limit per subject, then refuse until the window passes", async () => {
    await scenario(async (h) => {
      // Clear hits left by earlier runs (rolled back with the scenario), so the count below is ours.
      await h.tx.execute(sql`select public.prune_rate_limits()`);
      const user = await h.createUser();
      const take = async (subject: string) =>
        (
          await h.as(h.claimsFor(user), (tx) =>
            tx.execute<{ ok: boolean }>(sql`select public.take_rate_limit('respond', ${subject}, 3, '1 hour'::interval) as ok`),
          )
        )[0]?.ok;
      expect([await take("a"), await take("a"), await take("a"), await take("a")]).toEqual([true, true, true, false]);
      // Someone else has their own count.
      expect(await take("b")).toBe(true);
      // Once the old hits fall out of the window, there's room again.
      await h.tx.execute(sql`update public.rate_limit_hits set created_at = now() - interval '2 hours' where subject = 'a'`);
      expect(await take("a")).toBe(true);
      // The daily job forgets anything older than two days.
      await h.tx.execute(sql`update public.rate_limit_hits set created_at = now() - interval '3 days' where subject = 'b'`);
      const [pruned] = await h.tx.execute<{ n: number }>(sql`select public.prune_rate_limits() as n`);
      expect(pruned?.n).toBe(1);
    });
  });

  it("keep the records private", async () => {
    await scenario(async (h) => {
      const user = await h.createUser();
      await expectPgError(h.as(h.claimsFor(user), (tx) => tx.execute(sql`select * from public.rate_limit_hits`)), PG.insufficientPrivilege);
      await expectPgError(h.as(null, (tx) => tx.execute(sql`delete from public.rate_limit_hits`)), PG.insufficientPrivilege);
      await expectPgError(h.as(h.claimsFor(user), (tx) => tx.execute(sql`select public.prune_rate_limits()`)), PG.insufficientPrivilege);
    });
  });
});
