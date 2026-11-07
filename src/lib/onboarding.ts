import "server-only";
import { eq } from "drizzle-orm";
import { asAnon } from "@/lib/db/rls";
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
