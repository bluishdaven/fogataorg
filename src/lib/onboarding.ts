import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { asAnon, withRls } from "@/lib/db/rls";
import type { DbExecutor } from "@/lib/db/rls-context";
import { profiles } from "@/lib/db/schema";
import { localeOfPath, welcomePath } from "@/lib/domain/onboarding";
import type { Locale } from "@/lib/domain/locale";

/** Where to send someone right after they sign in: `next`, or the welcome steps if they're new. */
export async function afterSignInPath(userId: string, next: string): Promise<string> {
  const [row] = await asAnon((tx) =>
    tx.select({ onboardedAt: profiles.onboardedAt, locale: profiles.locale }).from(profiles).where(eq(profiles.id, userId)).limit(1),
  );
  if (!row || row.onboardedAt) return next;
  return welcomePath(next, localeOfPath(next) ?? (row.locale as Locale));
}

/** How recently an account must have been created for a sign-in to count as its sign-up. */
const SIGN_UP_WINDOW = sql`now() - interval '10 minutes'`;

/**
 * Google sign-ups: saves the language the person was using on Fogata as their account's language
 * (magic links send it with the sign-up instead). Only for accounts created moments ago, so a
 * returning reader signing in from the other language keeps theirs.
 */
export async function saveSignUpLocale(user: { id: string; email?: string }, locale: Locale): Promise<void> {
  await withRls({ sub: user.id, email: user.email }, (tx) => setSignUpLocale(tx, user.id, locale));
}

/** The update itself, as the person (RLS: own profile; `locale` has a column grant). Returns whether it applied. */
export async function setSignUpLocale(tx: DbExecutor, userId: string, locale: Locale): Promise<boolean> {
  const rows = await tx
    .update(profiles)
    .set({ locale })
    .where(and(eq(profiles.id, userId), gt(profiles.createdAt, SIGN_UP_WINDOW)))
    .returning({ id: profiles.id });
  return rows.length > 0;
}
