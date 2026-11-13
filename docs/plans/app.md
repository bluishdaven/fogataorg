# Fogata as an installable app (PWA)

## Status (2026-11-12)

Built as planned. Differences: the Install entry point is the footer only (Settings links to it
from the push section on iPhones); pages also keep the `/_next/static` files the current tab loaded
on demand (`performance` entries), since some chunks are only named inside other scripts; pictures
are kept only when their server allows CORS (opaque copies eat the device quota); the data
download lists push devices by service, not address. `next dev`'s hot-reload client can't start
offline, so offline pages only come alive on production builds (the e2e test checks the list there).

Approved by the owner (2026-11-12, "Yes, build it"): step 1 of the app plan. Fogata becomes
installable from the browser, saved stories can be read offline, and readers can opt in to push
notifications on a device. No app stores yet (that's step 3, after reports), no paid services,
no stack change. One new npm dependency: `web-push` (free, sends Web Push from our server).

## 1. Manifest, icons, install page

- `src/app/manifest.ts` → `/manifest.webmanifest` (the proxy skips paths with a dot). Name
  "Fogata", `start_url: "/"` (the proxy picks the language), standalone, cream/dark theme colors,
  shortcuts to Saved, Write and Notifications.
- Icons in `public/app/`: 192 and 512 "any" (flame on cream, like `apple-icon.png`), a 512
  maskable one (flame inside the safe zone) and a 96 monochrome badge for Android's status bar.
  Made with `sharp` from `icon.svg` by `scripts/make-app-icons.ts` (rerun if the flame changes).
- `/[locale]/app` ("Fogata on your phone"): what installing gives you (offline saved stories,
  notifications), an Install button where the browser offers one (`beforeinstallprompt`, Chromium),
  and Add to Home Screen steps for iPhone/iPad Safari. Says so once it's installed. Linked from the
  footer and from Settings → Notifications. No banners or nagging: quiet by design.

## 2. Service worker and offline saved stories

- `public/sw.js`, registered from the root layout (`<AppShell>` client component) on production
  builds, and on dev only with `NEXT_PUBLIC_SW_DEV=true` (e2e), so HMR stays untouched otherwise.
  Served `no-cache` with its own strict CSP.
- Online behavior doesn't change: requests go to the network first. Only when that fails does the
  worker answer, from its caches:
  - page loads → a downloaded story, else the offline page (`/[locale]/offline`, precached);
  - `/_next/static/*` → whatever downloads cached.
- **Downloads.** Saving a story on a device that has the worker also keeps it offline (HTML plus the
  `/_next/static` files it names, and its pictures best-effort). `/me/saved` gets "Keep saved
  stories offline", which downloads the newest 50 saved stories and drops cached ones no longer
  saved. Visiting a downloaded story while online refreshes its copy. Unsaving removes it.
- `/[locale]/offline` lists what this device has (`localStorage["fogata:offline"]`: url, title,
  writer, when) and links to them.
- Signing out clears the offline caches and the list (copies carry the reader's own page state).
- Risks: the copy is the full story page as the reader saw it; client features that need the
  network (sparks, responses) fail softly offline. Storage is the browser's to evict; the page says
  copies may be removed when the device is low on space.

## 3. Opt-in web push

- Table `push_subscriptions` (id, user_id → profiles cascade, endpoint unique, p256dh, auth,
  locale, created_at, last_success_at). RLS own-only select/insert/delete; revoke all, grant those.
  Endpoint must be https on a known push service (`isPushServiceEndpoint()`: FCM, Mozilla, Apple,
  Windows): our server POSTs to it, so arbitrary URLs would be an SSRF hole.
- `notifications.pushed_at`: when the group was last pushed. A group is pending when unread, active
  in the last hour and `pushed_at` is null or older than `updated_at`.
- `sendPendingPushes()` (`src/lib/push/`) runs on the owner `db` (like the email job: it reads
  other people's notifications and subscriptions; takes no user input): claims pending groups for
  people with a subscription by stamping `pushed_at`, builds the text with `notificationMessage()`
  / `notificationPath()` in the subscription's locale, and sends with `web-push`. 404/410 from the
  push service deletes the subscription. Called through `after()` (`pushSoon()`) by the actions
  that create notifications (follow, sparks, responses and edits, response sparks, circle
  submissions and decisions, join requests and decisions, transfers, publishing, featuring, donor
  badges) and by the daily cron (scheduled-story badges).
- One OS notification per group (`tag` = group id): new people joining a group replace it quietly
  instead of buzzing again. Tapping opens the link (focusing an open Fogata window if there is one).
- Settings → Notifications: "Notifications on this device" switch (asks the browser's permission
  only when switched on). On iPhone it explains that Fogata must be added to the Home Screen first.
  Hidden when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` isn't set.
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:hola@fogata.org`).
  `npm run setup:env` generates a local pair; the owner adds production keys in Vercel.
- Privacy policy: push subscriptions (an address at the browser maker's push service) and that
  notification text passes through it encrypted. Data download includes subscriptions' devices count.

## Tests

- Unit: endpoint allowlist, offline URL extraction, manifest shape, push payload builder.
- DB: push_subscriptions RLS (own only), pending/claim query.
- E2E: manifest + icons served; `/app` page; offline flow (save → go offline → story loads → an
  unsaved page shows the offline page) with the worker enabled; push switch hidden without key.
