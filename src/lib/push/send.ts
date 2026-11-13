import "server-only";
import { inArray, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { selectNotificationItems } from "@/lib/data/notification-items";
import type { DbExecutor } from "@/lib/db/rls-context";
import { notifications, pushSubscriptions } from "@/lib/db/schema";
import { isLocale, type Locale } from "@/lib/domain/locale";
import type { SocialTranslator } from "@/lib/domain/notification-text";
import { isPushServiceEndpoint, PUSH_BATCH, PUSH_WINDOW_MS, pushPayload } from "@/lib/domain/push";

/**
 * Sends push notifications for notification groups that changed since they were last pushed
 * (docs/plans/app.md). Runs on the owner connection, like the weekly email: it reads other
 * people's notifications and devices, and takes no user input. Claims groups by stamping
 * `pushed_at` first, so overlapping runs never push the same change twice.
 */

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT?.trim() || "mailto:hola@fogata.org" };
}

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
/** Delivers one push; resolves with the push service's status code (throws on network errors). */
export type PushSender = (target: PushTarget, payload: string) => Promise<number>;

export function webPushSender(config: PushConfig): PushSender {
  return async (target, payload) => {
    try {
      const result = await webpush.sendNotification(target, payload, {
        vapidDetails: config,
        // Stale news isn't worth delivering to a phone that was off all day.
        TTL: 6 * 60 * 60,
        urgency: "normal",
        timeout: 10_000,
      });
      return result.statusCode;
    } catch (error) {
      if (error instanceof webpush.WebPushError) return error.statusCode;
      throw error;
    }
  };
}

export type PushResult = { groups: number; sent: number; failed: number; removed: number };

const messages = { en, es } as const;
const translators = new Map<Locale, SocialTranslator>();
function socialT(locale: Locale): SocialTranslator {
  let t = translators.get(locale);
  if (!t) {
    const social = createTranslator({ locale, messages: messages[locale], namespace: "Social" });
    t = (key, values) => (social as unknown as (k: string, v: Record<string, string | number>) => string)(key, values);
    translators.set(locale, t);
  }
  return t;
}

export async function sendPendingPushes(job: { db: DbExecutor; send: PushSender; onlyUserIds?: string[] }): Promise<PushResult> {
  const { db, send } = job;
  const result: PushResult = { groups: 0, sent: 0, failed: 0, removed: 0 };
  const windowSeconds = Math.round(PUSH_WINDOW_MS / 1000);
  const onlyUsers = job.onlyUserIds?.length
    ? sql`and n2.user_id in (${sql.join(
        job.onlyUserIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;

  const claimed = await db.execute<{ id: string; user_id: string }>(sql`
    update public.notifications n set pushed_at = now()
    where n.id in (
      select n2.id from public.notifications n2
      where n2.read_at is null
        and (n2.pushed_at is null or n2.pushed_at < n2.updated_at)
        and n2.updated_at > now() - make_interval(secs => ${windowSeconds})
        and exists (select 1 from public.push_subscriptions s where s.user_id = n2.user_id)
        ${onlyUsers}
      order by n2.updated_at
      limit ${PUSH_BATCH}
      for update skip locked
    )
    returning n.id, n.user_id
  `);
  if (!claimed.length) return result;
  result.groups = claimed.length;

  const ownerOf = new Map(claimed.map((row) => [row.id, row.user_id]));
  const items = await selectNotificationItems(db, inArray(notifications.id, [...ownerOf.keys()]), claimed.length);
  const devices = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      locale: pushSubscriptions.locale,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, [...new Set(ownerOf.values())]));

  const gone: string[] = [];
  const delivered: string[] = [];
  for (const device of devices) {
    // Addresses are checked when saved; check again before our server POSTs anywhere.
    if (!isPushServiceEndpoint(device.endpoint)) {
      gone.push(device.id);
      continue;
    }
    const locale: Locale = isLocale(device.locale) ? device.locale : "en";
    const target = { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } };
    for (const item of items) {
      if (ownerOf.get(item.id) !== device.userId) continue;
      try {
        const status = await send(target, JSON.stringify(pushPayload(socialT(locale), item, locale)));
        if (status === 404 || status === 410) {
          // The browser dropped this subscription (unsubscribed, uninstalled, expired).
          gone.push(device.id);
          break;
        }
        if (status >= 200 && status < 300) {
          result.sent += 1;
          delivered.push(device.id);
        } else {
          result.failed += 1;
          console.warn("[push] not accepted", { status, host: new URL(device.endpoint).hostname });
        }
      } catch (error) {
        result.failed += 1;
        console.warn("[push] failed", { host: new URL(device.endpoint).hostname, error: error instanceof Error ? error.message : error });
      }
    }
  }

  if (gone.length) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    result.removed = gone.length;
  }
  if (delivered.length) {
    await db.update(pushSubscriptions).set({ lastSuccessAt: sql`now()` }).where(inArray(pushSubscriptions.id, [...new Set(delivered)]));
  }
  return result;
}
