"use client";

import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import type { Locale } from "@/lib/domain/locale";
import { publicEnv } from "@/lib/env";
import { clearOffline, registerServiceWorker, serviceWorkerWanted } from "@/lib/offline";

/**
 * Push notifications in the browser (docs/plans/app.md): turning them on for this device, off, and
 * forgetting the device on sign-out.
 */

const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return Boolean(publicKey) && serviceWorkerWanted() && "PushManager" in window && "Notification" in window;
}

function applicationServerKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerWanted()) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function toInput(subscription: PushSubscription, locale: Locale) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth }, locale };
}

/** Asks the browser (it shows its own prompt) and saves this device. */
export async function enablePush(locale: Locale): Promise<"on" | "denied" | "failed"> {
  if (!pushSupported() || !publicKey) return "failed";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const reg = await registration();
    if (!reg) return "failed";
    await navigator.serviceWorker.ready;
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) }));
    const saved = await savePushSubscription(toInput(subscription, locale));
    if (!saved.ok) {
      await subscription.unsubscribe();
      return "failed";
    }
    return "on";
  } catch {
    return "failed";
  }
}

/** Keeps the saved subscription current (the browser may rotate it; the language may change). */
export async function refreshPush(locale: Locale): Promise<boolean> {
  const subscription = await currentPushSubscription();
  if (!subscription || Notification.permission !== "granted") return false;
  const saved = await savePushSubscription(toInput(subscription, locale)).catch(() => null);
  return Boolean(saved?.ok);
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await removePushSubscription(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/**
 * Signing out: this device stops getting the person's notifications and drops the pages it kept
 * for them. Gives up after a moment so signing out never hangs.
 */
export async function forgetDevice(): Promise<void> {
  const work = Promise.all([disablePush().catch(() => undefined), clearOffline()]);
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, 2000))]);
}
