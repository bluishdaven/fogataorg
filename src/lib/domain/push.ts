import { z } from "zod";
import { LOCALES } from "./locale";
import { notificationMessage, notificationPath, type NotificationItem, type SocialTranslator } from "./notification-text";

/**
 * Push notifications (docs/plans/app.md): which addresses we push to and what a push says.
 */

/**
 * Browsers' push services. Our server POSTs to whatever address a browser hands out, so only these
 * are accepted: anything else would let someone aim our server at arbitrary URLs.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isPushServiceEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** What the browser's PushSubscription.toJSON() gives, plus the language to write in. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushServiceEndpoint),
  keys: z.object({
    p256dh: z.string().min(40).max(200).regex(/^[A-Za-z0-9_-]+=*$/),
    auth: z.string().min(10).max(100).regex(/^[A-Za-z0-9_-]+=*$/),
  }),
  locale: z.enum(LOCALES),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushEndpointSchema = z.string().max(1000).refine(isPushServiceEndpoint);

/** Groups that changed longer ago than this aren't pushed (the moment has passed; the bell has them). */
export const PUSH_WINDOW_MS = 60 * 60_000;

/** Most notification groups one run pushes. */
export const PUSH_BATCH = 200;

export type PushPayload = { title: string; body: string; url: string; tag: string; lang: string };

/** The push for one notification group: same words and link as the bell and the weekly email. */
export function pushPayload(t: SocialTranslator, item: NotificationItem & { id: string }, locale: string): PushPayload {
  return {
    title: "Fogata",
    body: notificationMessage(t, item),
    url: notificationPath(item, locale),
    // One notification per group: new people joining replace it instead of stacking up.
    tag: `n-${item.id}`,
    lang: locale,
  };
}
