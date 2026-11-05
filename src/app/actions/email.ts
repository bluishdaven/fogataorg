"use server";

import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import {
  emailFrequencyInputSchema,
  unsubscribeInputSchema,
  type EmailSettingsResult,
} from "@/lib/domain/email-settings";
import { unsubscribeWithToken } from "@/lib/email/preferences";

export async function setEmailFrequency(input: unknown): Promise<EmailSettingsResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const parsed = emailFrequencyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  await withRls(viewer.claims, (tx) =>
    tx.update(profiles).set({ emailFrequency: parsed.data.frequency }).where(eq(profiles.id, viewer.id)),
  );
  return { ok: true };
}

/** Confirm button on the unsubscribe page; works without signing in. */
export async function confirmUnsubscribe(input: unknown): Promise<EmailSettingsResult> {
  const parsed = unsubscribeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const done = await unsubscribeWithToken(parsed.data.token);
  return done ? { ok: true } : { ok: false, error: "invalid" };
}
