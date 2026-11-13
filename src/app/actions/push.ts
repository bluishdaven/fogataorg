"use server";

import { and, eq, sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { pushSubscriptions } from "@/lib/db/schema";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/domain/push";

type PushResult = { ok: true } | { ok: false; error: "unauthorized" | "invalid" };

/**
 * Saves this device for push notifications (the browser's subscription, already granted). Also
 * re-saves it on later visits, so a rotated subscription or a changed language stays current.
 */
export async function savePushSubscription(input: unknown): Promise<PushResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const { endpoint, keys, locale } = parsed.data;
  await withRls(viewer.claims, (tx) =>
    tx.execute(sql`select public.save_push_subscription(${endpoint}, ${keys.p256dh}, ${keys.auth}, ${locale}::public.locale_code)`),
  );
  return { ok: true };
}

/** Forgets this device (turned off, or signing out). Only the reader's own devices. */
export async function removePushSubscription(endpoint: unknown): Promise<PushResult> {
  const parsed = pushEndpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  await withRls(viewer.claims, (tx) =>
    tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, parsed.data), eq(pushSubscriptions.userId, viewer.id))),
  );
  return { ok: true };
}
