"use client";

import { useEffect, useSyncExternalStore } from "react";
import { registerServiceWorker } from "@/lib/offline";

/**
 * Installable-app plumbing for every page (docs/plans/app.md): registers the service worker once
 * the page has loaded, and holds on to the browser's install offer (Chromium fires
 * `beforeinstallprompt` once, early) so the app page can show an Install button later.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let offer: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function AppShell() {
  useEffect(() => {
    const onOffer = (event: Event) => {
      // Keep the browser's mini-infobar quiet; the app page offers it when someone asks.
      event.preventDefault();
      offer = event as InstallPromptEvent;
      emit();
    };
    const onInstalled = () => {
      offer = null;
      installed = true;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onOffer);
    window.addEventListener("appinstalled", onInstalled);
    const register = () => void registerServiceWorker();
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("load", register);
    };
  }, []);
  return null;
}

export type InstallState = "installed" | "offer" | "ios" | "manual";

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone and iPad Safari (iPads report a Mac with touch). */
export function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function snapshot(): InstallState {
  if (installed || isStandalone()) return "installed";
  if (offer) return "offer";
  return isAppleMobile() ? "ios" : "manual";
}

/** How this browser can install Fogata, or whether it already runs installed. Null while server rendering. */
export function useInstallState(): InstallState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** Shows the browser's install dialog; true when the reader accepted. */
export async function promptInstall(): Promise<boolean> {
  const current = offer;
  if (!current) return false;
  offer = null;
  emit();
  await current.prompt();
  const choice = await current.userChoice;
  return choice.outcome === "accepted";
}
