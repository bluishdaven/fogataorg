/*
 * Fogata's service worker (docs/plans/app.md). Online, nothing changes: every request goes to the
 * network. Only when the network fails does it answer from what this device downloaded (pages call
 * src/lib/offline.ts to download; this file never decides what to keep). It also shows push
 * notifications and opens them.
 *
 * Keep CACHE in step with OFFLINE_CACHE in src/lib/domain/app.ts.
 */
const CACHE = "fogata-offline-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Page loads don't wait for the worker to start.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("fogata-") && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** A downloaded page answers for its address whatever the query or fragment. */
function pageKey(url) {
  return url.origin + url.pathname;
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return cache.match(request, { ignoreVary: true });
}

async function navigate(event) {
  const url = new URL(event.request.url);
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const page = await cache.match(pageKey(url), { ignoreVary: true });
    if (page) return page;
    const spanish = url.pathname.startsWith("/es") || (!url.pathname.startsWith("/en") && (self.navigator.language || "").startsWith("es"));
    const offline = await cache.match(`${url.origin}/${spanish ? "es" : "en"}/offline`, { ignoreVary: true });
    if (offline) return offline;
    throw error;
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await fromCache(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  const url = new URL(request.url);
  if ((url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) || request.destination === "image") {
    event.respondWith(networkFirst(request));
  }
});

// Push: { title, body, url, tag, lang } from src/lib/push/send.ts. One notification per group (tag),
// so more people joining a group replaces it quietly instead of buzzing again.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Fogata";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/app/icon-192.png",
      badge: "/app/badge-96.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      lang: typeof data.lang === "string" ? data.lang : undefined,
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  // Only our own pages.
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) return open.navigate(target).catch(() => self.clients.openWindow(target));
        return undefined;
      }
      return self.clients.openWindow(target);
    })(),
  );
});
