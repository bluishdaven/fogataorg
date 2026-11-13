"use client";

import {
  imageUrls,
  OFFLINE_CACHE,
  OFFLINE_LIST_KEY,
  parseOfflineList,
  staticAssetPaths,
  withOfflineStory,
  type OfflineStory,
} from "@/lib/domain/app";

/**
 * What this device keeps for reading offline (docs/plans/app.md). Pages download; the service
 * worker (public/sw.js) only serves what's here when the network fails. Everything is best-effort:
 * browsers without the Cache API, private windows and full disks just don't keep copies.
 */

const OFFLINE_PAGES = ["/en/offline", "/es/offline"];
const OFFLINE_PAGES_KEY = "fogata:offline-pages";
const DAY_MS = 24 * 60 * 60_000;
/** Dev servers only register the worker when asked (e2e), so hot reloading stays untouched. */
export const SW_DEV_KEY = "fogata:sw-dev";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function serviceWorkerWanted(): boolean {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || typeof caches === "undefined") return false;
  return process.env.NODE_ENV === "production" || storage()?.getItem(SW_DEV_KEY) === "on";
}

/** True once a worker controls this page, so downloads can actually be served offline. */
export function offlineReady(): boolean {
  return serviceWorkerWanted() && Boolean(navigator.serviceWorker.controller);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerWanted()) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    void keepOfflinePages();
    return registration;
  } catch {
    return null;
  }
}

export function offlineStories(): OfflineStory[] {
  return parseOfflineList(offlineListRaw());
}

/** The stored list as text: a stable snapshot for useSyncExternalStore. */
export function offlineListRaw(): string | null {
  return storage()?.getItem(OFFLINE_LIST_KEY) ?? null;
}

/** Fired on window whenever the list changes in this tab (other tabs get `storage`). */
export const OFFLINE_EVENT = "fogata:offline";

function saveList(list: OfflineStory[]) {
  try {
    storage()?.setItem(OFFLINE_LIST_KEY, JSON.stringify(list));
  } catch {
    // Full or blocked storage: the copies still work, the offline page just can't list them.
  }
  window.dispatchEvent(new Event(OFFLINE_EVENT));
}

const pageKey = (path: string) => new URL(path, window.location.origin).href;

/** Copies a page and the files it needs into the cache. Returns the page's final path. */
async function downloadPage(cache: Cache, path: string): Promise<string> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", headers: { accept: "text/html" } });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("text/html")) throw new Error(`Not a page: ${response.status}`);
  const html = await response.text();
  // An old username redirects: keep it under the address it ended up at. A fresh Response, because
  // a worker may not answer a page load with a redirected one.
  const finalPath = new URL(response.url || pageKey(path)).pathname;
  await cache.put(pageKey(finalPath), new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));

  // What the page names, plus what this tab loaded on demand (same build, so the downloaded page
  // asks for the same files when it starts up offline).
  const assets = [...new Set([...staticAssetPaths(html), ...loadedStaticAssets()])];
  await inBatches(assets, 6, async (asset) => {
    if (await cache.match(pageKey(asset))) return;
    await cache.add(pageKey(asset)).catch(() => undefined);
  });
  // Pictures only where their server allows it (CORS): opaque copies would eat the device's quota.
  await inBatches(imageUrls(html), 4, async (src) => {
    if (await cache.match(src)) return;
    const image = await fetch(src, { mode: "cors", credentials: "omit" }).catch(() => null);
    if (image?.ok) await cache.put(src, image).catch(() => undefined);
  });
  return finalPath;
}

/** `/_next/static` files this tab has loaded so far, including chunks scripts fetched on their own. */
function loadedStaticAssets(): string[] {
  try {
    return performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name))
      .filter((url) => url.origin === window.location.origin && url.pathname.startsWith("/_next/static/"))
      .map((url) => url.pathname + url.search);
  } catch {
    return [];
  }
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map((item) => run(item).catch(() => undefined)));
  }
}

/** The offline page in both languages, refreshed at most daily. */
async function keepOfflinePages() {
  const last = Number(storage()?.getItem(OFFLINE_PAGES_KEY) ?? 0);
  if (Date.now() - last < DAY_MS) return;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    for (const path of OFFLINE_PAGES) await downloadPage(cache, path);
    storage()?.setItem(OFFLINE_PAGES_KEY, String(Date.now()));
  } catch {
    // Try again next visit.
  }
}

/** Keeps (or refreshes) a story on this device. */
export async function downloadStory(story: Omit<OfflineStory, "savedAt">): Promise<boolean> {
  if (!serviceWorkerWanted()) return false;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const url = await downloadPage(cache, story.url);
    saveList(withOfflineStory(offlineStories().filter((item) => item.url !== story.url), { ...story, url, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export async function removeStory(url: string): Promise<void> {
  saveList(offlineStories().filter((item) => item.url !== url));
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.delete(pageKey(url));
    await pruneFiles(cache);
  } catch {
    // Nothing to remove.
  }
}

/**
 * Downloads every story given and lets go of downloaded ones that aren't in it (no longer saved).
 * `onProgress` gets how many are done.
 */
export async function syncStories(stories: Omit<OfflineStory, "savedAt">[], onProgress?: (done: number) => void): Promise<number> {
  if (!serviceWorkerWanted()) return 0;
  const wanted = new Set(stories.map((story) => story.url));
  for (const old of offlineStories()) if (!wanted.has(old.url)) await removeStory(old.url);
  let kept = 0;
  for (const [index, story] of stories.entries()) {
    if (await downloadStory(story)) kept += 1;
    onProgress?.(index + 1);
  }
  try {
    await pruneFiles(await caches.open(OFFLINE_CACHE));
  } catch {
    // Pruning is housekeeping.
  }
  return kept;
}

/** Drops scripts, styles and pictures no downloaded page needs any more (old deploys, unsaved stories). */
async function pruneFiles(cache: Cache) {
  const requests = await cache.keys();
  const pages = requests.filter((request) => {
    const url = new URL(request.url);
    return url.origin === window.location.origin && !url.pathname.startsWith("/_next/");
  });
  const needed = new Set<string>();
  for (const page of pages) {
    const html = await (await cache.match(page))?.text();
    if (!html) continue;
    for (const asset of staticAssetPaths(html)) needed.add(pageKey(asset));
    for (const src of imageUrls(html)) needed.add(src);
  }
  for (const request of requests) {
    if (pages.includes(request) || needed.has(request.url)) continue;
    await cache.delete(request);
  }
}

/** Signing out: no copies of pages as this reader saw them stay behind. */
export async function clearOffline(): Promise<void> {
  try {
    storage()?.removeItem(OFFLINE_LIST_KEY);
    storage()?.removeItem(OFFLINE_PAGES_KEY);
    window.dispatchEvent(new Event(OFFLINE_EVENT));
    if (typeof caches !== "undefined") await caches.delete(OFFLINE_CACHE);
  } catch {
    // Nothing kept.
  }
}
