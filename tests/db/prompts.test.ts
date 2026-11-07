import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { prompts, stories } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario } from "./harness";

afterAll(closeDb);

const weekSql = (offset: number) => sql`(date_trunc('week', now() at time zone 'utc')::date + ${offset}::integer)::date`;

describe("weekly sparks", () => {
  it("are written by admins and seen by everyone once their week starts", async () => {
    await scenario(async (h) => {
      const admin = await h.createUser();
      const writer = await h.createUser();
      const adminClaims = { ...h.claimsFor(admin), app_metadata: { role: "admin" } };
      const [rows] = await Promise.all([
        h.tx.execute<{ now: string; next: string }>(sql`select ${weekSql(0)}::text as now, ${weekSql(7)}::text as next`),
      ]);
      const { now, next } = rows[0]!;
      await h.tx.execute(sql`delete from public.prompts where week_of in (${now}::date, ${next}::date)`);

      await h.as(adminClaims, (tx) => tx.insert(prompts).values([{ weekOf: now, textEn: "A door", textEs: "Una puerta" }, { weekOf: next, textEn: "A key", textEs: "Una llave" }]));
      const visible = async (claims: Parameters<typeof h.as>[0]) =>
        (await h.as(claims, (tx) => tx.select({ weekOf: prompts.weekOf }).from(prompts))).map((row) => row.weekOf);
      expect(await visible(null)).toContain(now);
      expect(await visible(null)).not.toContain(next);
      expect(await visible(h.claimsFor(writer))).not.toContain(next);
      expect(await visible(adminClaims)).toContain(next);

      await expectPgError(h.as(h.claimsFor(writer), (tx) => tx.insert(prompts).values({ weekOf: next, textEn: "x", textEs: "y" })), PG.insufficientPrivilege);
      await expectPgError(h.savepoint((tx) => tx.insert(prompts).values({ weekOf: sql`${weekSql(1)}` as unknown as string, textEn: "x", textEs: "y" })), PG.checkViolation);

      // Stories answer sparks that have started, not ones written ahead.
      const [current] = await h.tx.select({ id: prompts.id }).from(prompts).where(eq(prompts.weekOf, now));
      const [upcoming] = await h.tx.select({ id: prompts.id }).from(prompts).where(eq(prompts.weekOf, next));
      await h.as(h.claimsFor(writer), (tx) => tx.insert(stories).values({ authorId: writer, title: "", slug: `draft-${Date.now()}`, language: "es", promptId: current!.id }));
      await expectPgError(
        h.as(h.claimsFor(writer), (tx) => tx.insert(stories).values({ authorId: writer, title: "", slug: `draft-${Date.now()}-b`, language: "es", promptId: upcoming!.id })),
        PG.insufficientPrivilege,
      );
    });
  });
});
