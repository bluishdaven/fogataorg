import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/domain/email-tokens";
import type { Locale } from "@/lib/domain/locale";
import { emailSigningSecret } from "./config";

/** The user id an unsubscribe token belongs to, or null if it isn't valid. */
export function userIdFromUnsubscribeToken(token: unknown): string | null {
  const secret = emailSigningSecret();
  return secret ? verifyUnsubscribeToken(token, secret) : null;
}

/**
 * Turns summary emails off for the token's owner. Runs as the owner because
 * the reader isn't signed in: the signed token is the proof. It can only ever
 * set `email_frequency` to 'off' for that one profile.
 */
export async function unsubscribeWithToken(token: unknown): Promise<{ locale: Locale } | null> {
  const userId = userIdFromUnsubscribeToken(token);
  if (!userId) return null;
  const [row] = await db
    .update(profiles)
    .set({ emailFrequency: "off" })
    .where(eq(profiles.id, userId))
    .returning({ locale: profiles.locale });
  return row ? { locale: row.locale } : null;
}
