import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import {
  APP_MANIFEST,
  imageUrls,
  OFFLINE_CACHE,
  parseOfflineList,
  staticAssetPaths,
  withOfflineStory,
} from "@/lib/domain/app";
import type { SocialTranslator } from "@/lib/domain/notification-text";
import { isPushServiceEndpoint, pushPayload, pushSubscriptionSchema } from "@/lib/domain/push";

const root = path.resolve(import.meta.dirname, "../..");

describe("manifest", () => {
  it("is installable: name, start URL, standalone, 192 and 512 icons and a maskable one", () => {
    expect(APP_MANIFEST.name).toBe("Fogata");
    expect(APP_MANIFEST.start_url).toBe("/");
    expect(APP_MANIFEST.display).toBe("standalone");
    const icons = APP_MANIFEST.icons ?? [];
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) expect(() => readFileSync(path.join(root, "public", icon.src))).not.toThrow();
  });

  it("shortcuts are unprefixed, so the proxy picks the reader's language", () => {
    for (const shortcut of APP_MANIFEST.shortcuts ?? []) expect(shortcut.url).not.toMatch(/^\/(en|es)\//);
  });

  it("the service worker uses the same cache name as the pages", () => {
    const worker = readFileSync(path.join(root, "public/sw.js"), "utf8");
    expect(worker).toContain(`const CACHE = "${OFFLINE_CACHE}";`);
  });
});

describe("offline downloads", () => {
  it("finds the static files a page names, as attributes and inside the RSC payload", () => {
    const html = [
      '<link rel="stylesheet" href="/_next/static/css/app-1a2b.css">',
      '<script src="/_next/static/chunks/main-abc123.js" async></script>',
      '<link rel="preload" href="/_next/static/media/serif.p.woff2" as="font">',
      '<script>self.__next_f.push([1,"2:I[\\"static/chunks/page-9f8e.js\\",\\"static\\/chunks\\/x-1.js\\"]"])</script>',
    ].join("");
    expect(staticAssetPaths(html).sort()).toEqual(
      [
        "/_next/static/chunks/main-abc123.js",
        "/_next/static/chunks/page-9f8e.js",
        "/_next/static/chunks/x-1.js",
        "/_next/static/css/app-1a2b.css",
        "/_next/static/media/serif.p.woff2",
      ].sort(),
    );
  });

  it("keeps both spellings of chunk names with brackets", () => {
    const html = '<link href="/_next/static/chunks/%5Broot%5D__a._.css"><script>"static/chunks/[root]__a._.css"</script>';
    expect(staticAssetPaths(html).sort()).toEqual(["/_next/static/chunks/%5Broot%5D__a._.css", "/_next/static/chunks/[root]__a._.css"]);
  });

  it("keeps http(s) pictures only, once each, with entities decoded", () => {
    const html =
      '<img alt="" src="https://images.unsplash.com/photo-1?w=800&amp;ixid=abc"><img src="https://images.unsplash.com/photo-1?w=800&amp;ixid=abc">' +
      '<img src="data:image/png;base64,AAAA"><img class="x" src="/app/icon-192.png">';
    expect(imageUrls(html)).toEqual(["https://images.unsplash.com/photo-1?w=800&ixid=abc"]);
  });

  it("reads the device's list defensively and moves a refreshed story to the top", () => {
    expect(parseOfflineList(null)).toEqual([]);
    expect(parseOfflineList("{nope")).toEqual([]);
    expect(parseOfflineList('{"url":"/@a/b"}')).toEqual([]);
    const good = { url: "/@ana/fuego", title: "Fuego", author: "Ana", savedAt: "2026-11-12T10:00:00.000Z" };
    const list = parseOfflineList(JSON.stringify([good, { url: "https://evil.example/x", title: "x", author: "x", savedAt: "x" }, { title: 3 }]));
    expect(list).toEqual([good]);
    const other = { url: "/@bo/sea", title: "Sea", author: "Bo", savedAt: "2026-11-12T11:00:00.000Z" };
    const refreshed = { ...good, savedAt: "2026-11-12T12:00:00.000Z" };
    expect(withOfflineStory([other, good], refreshed)).toEqual([refreshed, other]);
  });
});

describe("push", () => {
  it("only pushes to browsers' push services, over https", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      "https://web.push.apple.com/QGx7",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ]) {
      expect(isPushServiceEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example/x",
      "https://notify.windows.com/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/push",
      "not a url",
    ]) {
      expect(isPushServiceEndpoint(bad), bad).toBe(false);
    }
  });

  it("validates what the browser hands over", () => {
    const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys, locale: "es" }).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://example.com/x", keys, locale: "es" }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x", keys: { ...keys, auth: "<script>" }, locale: "es" }).success).toBe(
      false,
    );
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x", keys, locale: "fr" }).success).toBe(false);
  });

  it("says what the bell says, in the device's language, one notification per group", () => {
    const item = {
      id: "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e",
      type: "response" as const,
      actor: { username: "ana", name: "Ana" },
      others: 2,
      story: { title: "El fuego", slug: "el-fuego", author: "bo" },
      responseExcerpt: "Qué bonito",
      circle: null,
    };
    const translator = (locale: "en" | "es"): SocialTranslator => {
      const t = createTranslator({ locale, messages: locale === "es" ? es : en, namespace: "Social" });
      return (key, values) => (t as unknown as (k: string, v: Record<string, string | number>) => string)(key, values);
    };
    const english = pushPayload(translator("en"), item, "en");
    expect(english).toMatchObject({ title: "Fogata", url: "/@bo/el-fuego#responses", tag: `n-${item.id}`, lang: "en" });
    expect(english.body).toContain("Ana");
    expect(english.body).toContain("El fuego");
    const spanish = pushPayload(translator("es"), item, "es");
    expect(spanish.body).not.toBe(english.body);
    expect(spanish.lang).toBe("es");
  });
});
