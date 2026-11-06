import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { profiles, stories } from "@/lib/db/schema";
import { countWords } from "@/lib/domain/content";
import { closeDb, expectPgError, PG, scenario } from "./harness";

afterAll(closeDb);

describe("word counts", () => {
  it("match the app's own word counting", async () => {
    await scenario(async (h) => {
      const samples = [
        "",
        "   ",
        "One two three.",
        "El niño comió piñas — y después, ¿qué? ¡Nada!",
        "Rock'n'roll is well-known; the 1990s were 'fine'.",
        "Ça va? Très bien… Ελληνικά and Ñandú",
        "palabra—otra / tercera  cuarta\n\nquinta",
      ];
      for (const text of samples) {
        const [row] = await h.tx.execute<{ n: number }>(sql`select public.count_words(${text}) as n`);
        expect(row?.n, text).toBe(countWords(text));
      }
    });
  });

  it("are generated from the live story text and can't be set by hand", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const [story] = await h.tx
        .insert(stories)
        .values({ authorId: author, title: "Cuenta", slug: `cuenta-${Date.now()}`, language: "es", contentText: "Una dos tres cuatro" })
        .returning({ id: stories.id });
      const words = async () =>
        (await h.tx.execute<{ n: number }>(sql`select word_count as n from public.stories where id = ${story!.id}`))[0]?.n;
      expect(await words()).toBe(4);
      await h.tx.update(stories).set({ contentText: "Ahora son cinco palabras aquí" }).where(eq(stories.id, story!.id));
      expect(await words()).toBe(5);
      await expectPgError(
        h.savepoint((tx) => tx.execute(sql`update public.stories set word_count = 9000 where id = ${story!.id}`)),
        "428C9",
      );
    });
  });
});

describe("profile extras", () => {
  it("are edited by their owner only, within limits", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const other = await h.createUser();
      const extras = {
        pronouns: "they/them",
        nowFocus: "watching" as const,
        nowText: "Perfect Days",
        influences: { books: ["Rayuela"], politics: ["Social democracy"] },
      };

      const mine = await h.as(h.claimsFor(owner), (tx) =>
        tx.update(profiles).set(extras).where(eq(profiles.id, owner)).returning({ id: profiles.id }),
      );
      expect(mine).toHaveLength(1);
      const [saved] = await h.tx
        .select({ pronouns: profiles.pronouns, nowFocus: profiles.nowFocus, nowText: profiles.nowText, influences: profiles.influences })
        .from(profiles)
        .where(eq(profiles.id, owner));
      expect(saved).toEqual(extras);

      // Someone else's row isn't theirs to change.
      const theirs = await h.as(h.claimsFor(other), (tx) =>
        tx.update(profiles).set({ pronouns: "nope" }).where(eq(profiles.id, owner)).returning({ id: profiles.id }),
      );
      expect(theirs).toHaveLength(0);

      // The database caps lengths and shape even through the Data API.
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) => tx.update(profiles).set({ pronouns: "x".repeat(41) }).where(eq(profiles.id, owner))),
        PG.checkViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) => tx.update(profiles).set({ nowText: "x".repeat(121) }).where(eq(profiles.id, owner))),
        PG.checkViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) =>
          tx.execute(sql`update public.profiles set influences = '["not", "an", "object"]'::jsonb where id = ${owner}`),
        ),
        PG.checkViolation,
      );
      await expectPgError(
        h.as(h.claimsFor(owner), (tx) =>
          tx.execute(sql`update public.profiles set influences = ${JSON.stringify({ books: ["x".repeat(4000)] })}::jsonb where id = ${owner}`),
        ),
        PG.checkViolation,
      );
    });
  });
});
