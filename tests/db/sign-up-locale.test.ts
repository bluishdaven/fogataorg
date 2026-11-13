import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { profiles } from "@/lib/db/schema";
import { setSignUpLocale } from "@/lib/onboarding";
import { closeDb, scenario } from "./harness";

afterAll(closeDb);

describe("Google sign-ups keep the language they signed up in", () => {
  it("sets it on accounts created moments ago, never on older ones or someone else's", async () => {
    await scenario(async (h) => {
      const fresh = await h.createUser();
      const other = await h.createUser();
      const localeOf = async (id: string) => (await h.tx.select({ locale: profiles.locale }).from(profiles).where(eq(profiles.id, id)))[0]!.locale;
      expect(await localeOf(fresh)).toBe("en");

      expect(await h.as(h.claimsFor(fresh), (tx) => setSignUpLocale(tx, fresh, "es"))).toBe(true);
      expect(await localeOf(fresh)).toBe("es");

      // Not someone else's profile (RLS).
      expect(await h.as(h.claimsFor(fresh), (tx) => setSignUpLocale(tx, other, "es"))).toBe(false);
      expect(await localeOf(other)).toBe("en");

      // A returning reader signing in from the other language keeps theirs.
      await h.tx.update(profiles).set({ createdAt: sql`now() - interval '1 day'` }).where(eq(profiles.id, fresh));
      expect(await h.as(h.claimsFor(fresh), (tx) => setSignUpLocale(tx, fresh, "en"))).toBe(false);
      expect(await localeOf(fresh)).toBe("es");
    });
  });
});
