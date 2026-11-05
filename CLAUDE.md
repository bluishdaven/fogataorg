# Fogata.org

Long-form reading and writing platform; the UI ships in English and Spanish. Product spec: `docs/PRODUCT_SPEC.md`.
Phase plans: `docs/plans/`. What shipped: `docs/CHANGELOG.md`. Setup and deploys: `docs/SETUP.md`.

@AGENTS.md

## Commands

| Task | Command |
| --- | --- |
| First-time local setup (Docker running) | `npm install && npm run setup` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Lint + typecheck + unit tests | `npm run check` |
| RLS tests (needs local Supabase) | `npm run test:db` |
| E2E tests (needs Supabase + seed) | `npm run test:e2e` (reuses a running dev server) |
| E2E against a production build | `npm run build && PORT=3100 npm run start`, then `PORT=3100 npm run test:e2e` |
| New migration from schema change | edit `src/lib/db/schema.ts` → `npm run db:generate -- --name <what>` |
| Hand-written SQL migration | `npm run db:migration -- --name <what>` |
| Apply migrations from scratch | `npm run db:reset` then `npm run db:seed` |
| Supabase Studio / Mailpit | http://127.0.0.1:54323 / http://127.0.0.1:54324 |

Run `npm run check` (and `test:db` / `test:e2e` when touching data or UI flows) before calling a step done.

## Architecture

- **Next.js 16.4, App Router, Cache Components on.** Pages are a static shell; anything reading
  cookies, headers, search params or runtime `params` must sit inside `<Suspense>`. Public data
  reads use `'use cache'` + `cacheTag` in `src/lib/data/*`. Never read request data at the top of a
  layout. Client hooks like `usePathname()` outside Suspense also block prerendering: read
  `window.location` in event handlers instead.
- **Search** (`src/lib/data/search.ts`). `stories.search_vector` is a generated tsvector (Spanish or
  English config by story language, accents folded with `public.f_unaccent`), defined in the
  `*_search.sql` migration, not in the Drizzle schema; query it with raw SQL. Titles, usernames and
  display names also have trigram indexes for typo tolerance.
- **Social** (`src/lib/data/social.ts`, `src/app/actions/social.ts`, `src/components/social/`). Follows,
  sparks (one row per reader per story, 1–50), bookmarks, responses (one reply level, optional
  `block_id` paragraph anchor) and response sparks. Notifications are written only by database
  triggers (`public.notify`), grouped per recipient/type/target while unread, and pushed to the bell
  through Supabase Realtime. Per-reader data on story pages loads in its own `<Suspense>` so the cached
  story text never waits for it. Pinning goes through `public.set_response_pinned()`.
- **Circles** (`src/lib/data/circles.ts`, `src/app/actions/circles.ts`, `src/components/circles/`).
  `circles` (accent color, optional header), `circle_members` (one owner created by trigger, editors,
  writers) and `circle_submissions` (pending → accepted/declined; one active circle per story; members'
  submissions are auto-accepted by an AFTER INSERT trigger because RLS checks run after BEFORE
  triggers). Editors decide; `decided_by/at` are stamped by trigger. Text on an accent always uses
  `readableTextOn()` (white or pure black, ≥ 4.58:1). Circle pages live at `/{locale}/circles/{slug}`.
- **Email** (`src/lib/email/`, `src/emails/`, `src/app/api/cron/notification-emails`). Fogata sends
  only sign-in links (Supabase Auth) and a weekly activity summary, never one email per event.
  `profiles.email_frequency` is `weekly` (default) or `off`; `profiles.email_weekday` (random 0–6 at
  sign-up, UTC, not user-editable yet) phases sends: a daily Vercel Cron (`vercel.json`, Bearer
  `CRON_SECRET`) emails only that weekday's readers, at most `EMAIL_SUMMARY_DAILY_LIMIT` (80) per run,
  longest-waiting first; the rest wait a week. The job claims a reader by
  stamping `email_last_sent_at` before sending (gives it back on failure) and marks covered
  notifications `emailed_at`; `notify()` clears `emailed_at` when a new actor joins a group. Resend
  when `RESEND_API_KEY` is set, else Mailpit (`MAILPIT_URL`). Wording and links come from
  `src/lib/domain/notification-text.ts`, shared with the notifications page. Unsubscribe tokens are
  HMAC-signed (`EMAIL_SIGNING_SECRET`); POST `/api/email/unsubscribe` is RFC 8058 one-click, and the
  footer link opens a confirm page because scanners prefetch GET links. The job and token unsubscribe
  are the only app code that uses the owner `db` (addresses live in `auth.users`; no session).
- **Notification times:** `notifications.updated_at` means "last new activity". Its trigger fires only
  on `actor_ids`/`actor_count` changes, so marking read or emailed never re-dates a group.
- **Raw SQL inside Drizzle selects:** on single-table queries Drizzle renders `${table.column}` unqualified,
  which breaks correlated subqueries (`"id"` resolves to the subquery's table). Write the qualified name
  (`"circles"."id"`) in those subqueries.
- **Grants vs. Drizzle inserts:** Drizzle names every column in INSERT (DEFAULT for unset ones), and
  Postgres checks column privileges even for DEFAULT, so don't rely on column-level INSERT grants;
  put "can't set X on insert" in the insert policy instead. Column-level UPDATE grants are fine.
- **Thumbnails** (`stories.thumbnail_url`) are set on publish: the cover, else the first figure.
- **Reader preferences** (size, typeface, width) live in localStorage and are applied to `<html>` by
  `READER_PREFS_SCRIPT` before paint; CSS reads the data attributes. The reading column width is
  `--measure` in rem, so headers and bodies always line up.
- **Home headline** (`src/lib/domain/headlines.ts`, `src/components/home-headline.tsx`). Every
  `Home.headlines` entry is rendered so the page stays static; `HEADLINE_SCRIPT` (root layout, before
  paint) sets `<html data-headline>` to one that differs from the last visit's (localStorage) and CSS
  shows only that one. Adding or removing headlines: change both message files and `HEADLINE_COUNT`.
- **Partial prefetching** also prerenders with the reader's cookies, where clock reads
  (`Date.now()`) are errors. Anything that checks a session or the current time must call
  `await connection()` first, as `getViewer()` does.
- **Routing.** UI pages live under `src/app/[locale]/` (`/en`, `/es`). Share URLs `/@handle` and
  `/@handle/slug` have no prefix: `src/proxy.ts` rewrites them to `/{locale}/u/...` using the
  `NEXT_LOCALE` cookie, then `Accept-Language`. Link to them with `next/link` and
  `storyPath()` / `profilePath()`, **not** the i18n `Link` (which would add a prefix).
- **i18n.** next-intl v4 with `next/root-params` for the locale. Messages in `messages/{en,es}.json`
  (typed from `en.json`; a test enforces key and ICU-argument parity). Server Actions and Route
  Handlers can't read root params: pass `locale` explicitly to `getTranslations`.
- **Database.** Drizzle schema in `src/lib/db/schema.ts` is the source of truth for tables and RLS
  policies. `drizzle-kit generate` writes SQL to `supabase/migrations/`, which the Supabase CLI
  applies (`db reset` locally, `db push` in the cloud). Triggers, functions and grants go in
  hand-written migrations next to the generated ones.
- **RLS is real.** `db` connects as the owner and bypasses RLS, so app code must use
  `withRls(claims, tx => …)` or `asAnon(tx => …)` from `src/lib/db/rls.ts`. They switch the
  transaction to Supabase's `anon` / `authenticated` role with JWT claims set. Public reads run as
  `anon` so drafts can't leak even if a filter is wrong.
- **Grants narrow what RLS can't.** Users may update only whitelisted profile columns and can never
  hard-delete stories. New tables: revoke all from `anon, authenticated`, then grant what's needed.
- **Auth.** Supabase Auth via `@supabase/ssr`. The proxy refreshes the session on every request.
  `getViewer()` (`src/lib/auth.ts`) is the only way to get the signed-in user. Magic links use the
  token-hash flow (`/auth/confirm`) so they work across browsers; Google uses PKCE (`/auth/callback`).
  Post-login redirects go through `safeNextPath()`.
- **Profile photos** (`src/lib/domain/avatars.ts`, `src/components/profile/upload-avatar.ts`,
  `src/components/avatar.tsx`). The browser center-crops to a square, scales to ≤512px and re-encodes
  WebP (strips EXIF/GPS), uploads to the public `avatars` bucket under `<user id>/<uuid>.webp` (storage
  policies: own folder only, WebP only, 1 MB), then `updateAvatar` saves the URL. Only URLs in the
  user's own folder are accepted, and a DB check (`profiles_avatar_url_own_folder`) enforces it even
  through the Data API. Replacing or removing a photo deletes the old file. Render avatars only with
  `<Avatar>`, which shows initials unless the URL is in our bucket; author queries carry `avatarUrl`.
- **Topics** come from a catalog migration (`*_topics_catalog.sql`, EN + ES names, upsert by slug).
  Add or rename topics with a new migration; the seed only references slugs that exist there.
- **Sharing** (`src/components/social/share-button.tsx`, `src/lib/domain/share.ts`). A menu in the story
  action bar: "Share via…" (system sheet, phones only), "Image for Stories", copy link, then one-tap
  WhatsApp, X, Facebook, LinkedIn, Threads, Telegram and email. Links use the unprefixed share URL on
  `NEXT_PUBLIC_SITE_URL`. Share previews use the cover, else the story's first picture.
- **Stories image** (`src/components/social/story-image.ts`, layout in `src/lib/domain/story-card.ts`).
  Drawn on a canvas in the browser (1080×1920, Instagram safe zones) with the page's own fonts: no
  server route and no font files. Its copy follows the story's language (`ShareCard` messages), not the
  reader's UI. Phones hand the PNG to the share sheet (rendering starts when the menu opens, because
  iOS only allows sharing shortly after a tap); desktops download it. Only our avatars bucket (CORS
  enabled) is drawn, so the canvas can't be tainted.
- **Badges** (`src/lib/domain/badges.ts`, `src/components/badges/`, plan in `docs/plans/badges.md`).
  Writing tiers come from a live count of published, public stories (`publishedCountSql` in
  `src/lib/data/badge-sql.ts`, carried by every author query as `badges`); ten tiers from 1 to 1,000.
  The donor badge lasts two months per grant (`profiles.donor_until`; a grant while active stacks on
  the time left), checked in SQL with `donorActiveSql()` so pages never read the clock. Only admins
  (`app_metadata.role = "admin"`, set in the Supabase dashboard) grant or remove it, through
  `grant_donor_badge` / `remove_donor_badge` on `/admin/donors`, with a private `donor_grants` log.
  Show badges with `<UserBadges>` right after a person's name; new screens that name people must too.
  New badges ring the bell: `check_writing_badge()` (stories/moderation triggers, plus
  `check_due_writing_badges()` in the daily cron for scheduled stories, so those arrive within a day)
  announces a tier only above `profiles.badge_tier_notified`, and `grant_donor_badge` notifies the
  donor. They're `badge`/`donor` notifications with no actors (`notifications.badge` holds the key),
  inserted by `notify_badge()`. SQL tier thresholds mirror `WRITING_TIERS` (a db test checks).
  The donor badge is a heart in flames.
- **Moderation** (`src/lib/data/moderation-sql.ts`, `src/components/moderation/`, `/admin/moderation`).
  Admins mark a story NSFW or remove it with a public reason via `moderate_story()`; state lives in
  `story_moderation` (public read, written only by that function, so authors can't undo it) and every
  action in the admin-only `moderation_log`. Removed: the story's address shows a "moderated for"
  notice, it leaves every list and the writer's tier count. NSFW: a click-through warning with the
  reason, no image in previews or lists, noindex, and off feeds (home, topics, circles, search) but
  still on the writer's profile and saved lists with a label. Queries over stories must use
  `notRemoved` (all lists) or `notModerated` (feeds).
- **Touch targets.** Buttons and inputs are 44px on phones and compact from `sm:` up (sizes in
  `components/ui/button.tsx` / `input.tsx`). Custom controls follow the same rule (`min-h-11` /
  `min-h-10 … sm:min-h-8`), or get an invisible `after:` hit area when they must stay small visually.
  Buttons are pill-shaped. On phones the header hides the wordmark once the account menu is present.
- **Public site vs. everything else.** `isPublicSite` (`src/lib/deployment.ts`) is true only on Vercel
  production (`VERCEL_ENV`, read at build time). Internal pages like the style guide (`/design`) 404
  there and drop out of the footer; local, CI and preview builds keep them because e2e tests use them.
  User-facing copy never mentions dev commands.
- **Domain rules** (`src/lib/domain/`) are pure TypeScript with unit tests: locales, routes, slugs,
  reading time, content text, redirects, Zod schemas. UI and data layers import from here.
- **Unsplash photos** (`src/lib/domain/unsplash.ts`, `src/lib/unsplash/`, `src/components/unsplash/`).
  Their API guidelines are conditions of use, so keep all four: (1) the access key stays on the
  server (`/api/unsplash/search` proxies searches, signed-in only, cached for hours); (2) images are
  hotlinked from `images.unsplash.com`, resized with `unsplashImageUrl()` which keeps the `ixid`
  param (use `UnsplashImage`, never re-host or proxy through `/_next/image`); (3) picking a photo
  calls `trackUnsplashSelection()` (their "download" event); (4) every displayed Unsplash photo gets
  `UnsplashCredit` ("Photo by X on Unsplash" with UTM links). Store `ImageCredit` next to the image
  (`stories.cover_credit`; inline images will carry it as a node attr).
- **Rendering stored content.** `StoryBody` renders Tiptap JSON through an allowlist of node and
  mark types, and only renders images from `allowedImagePrefixes()`. Never use
  `dangerouslySetInnerHTML` for user content.
- **Writing** (`src/components/editor/`, `src/app/actions/stories.ts`). Tiptap 3 editor (client-only,
  `immediatelyRender: false`) with custom `figure`, `callout` and `pullQuote` nodes, a `/` menu, a
  photo button in the editor bar (upload or Unsplash; `/` is awkward on phone keyboards) and a
  selection toolbar that shows only for focused, non-empty text selections (a fresh editor can start
  with everything selected). `insertFigure` never replaces a selected block. Tiptap's `BubbleMenu`
  doesn't forward `data-*` props to its floating element: put test ids on an inner element. Every save goes through `sanitizeStoryDoc()` (`src/lib/domain/story-doc.ts`), the
  server-side allowlist; never store client JSON without it. Snapshots sent to server actions must be
  JSON round-tripped: ProseMirror attrs are prototype-less objects that server actions refuse.
- **Autosave and publishing.** Saves carry a `revision`; a mismatch is a conflict, never an overwrite.
  Drafts save into the story; live stories save into `pending_changes` until "Publish changes".
  Scheduling is `status = 'published'` with a future `published_at` (RLS hides it until then; no cron).
  Publish actions call `updateTag` for `stories`, `story:<handle>/<slug>`, `profile:<handle>` and
  `topic:<slug>`. Drafts get a `draft-<id>` slug; the first publish sets the real one and it never
  changes after that.
- **Images.** Uploads are resized to ≤2400px WebP in the browser (strips EXIF/GPS) and stored in the
  `story-images` bucket under `<user id>/` (storage policies enforce the folder). They're served as-is
  (no Next image optimization yet). Unsplash images follow the rules above.

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`. Zod for every input crossing a trust boundary.
- Every feature ships with: types, Zod validation, RLS policy (+ grants), tests (unit, RLS, and e2e
  for flows), and ES + EN strings.
- Styling: Tailwind 4 with tokens in `src/app/globals.css` (light, dark, sepia). Use semantic
  tokens (`bg-background`, `text-muted-foreground`, `text-ember-text`), never raw colors. Every
  text/background pair must pass WCAG AA in all three themes (e2e axe tests check this).
- Skeletons, never spinners. Respect `prefers-reduced-motion` (`motion-safe:` utilities).
- Seed content is original and fictional; seed emails use the reserved `.test` TLD.
- Commit in small steps; never commit `.env*` (only `.env.example`).

## Decisions (and why)

- **Pinned stable lines over brand-new majors**: TypeScript 6.0 (typescript-eslint doesn't support
  7), ESLint 9 (`eslint-config-next` plugins don't support 10), Drizzle 0.45 (1.0 is RC),
  postgres.js 3.4 (4.0 shipped days before Phase 0), Supabase CLI 2.122 (3.0 likewise).
- **npm** over pnpm: preinstalled, nothing extra for contributors or CI.
- **Unprefixed share URLs**: stories have one language; links pasted into WhatsApp/X must be stable.
- **English fallback, browser detection first**: spec says English-first with Spanish as an equal.
- **Campfire vocabulary per locale**: ES UI says Chispas / Lo que arde; EN UI says Sparks /
  Burning now.
- **Two kinds of email only**: sign-in links and a weekly summary (or none). Quiet by design.
  Weekly sends are phased by a per-reader weekday so each day carries a seventh of them, which keeps
  Resend's free tier (100/day, shared with sign-in links) usable for longer; the daily cron fits
  Vercel Hobby.
- **No "Pro" tier anywhere**: everyone gets everything. Donations go through Buy Me a Coffee
  (`SUPPORT_URL` in `src/lib/domain/links.ts`, linked from the footer).
- **Dates render in UTC** until readers can choose a time zone (Phase 3 onboarding).
- **Reading speed** 238 wpm (EN) / 218 wpm (ES).
- **Unsplash hotlinking over privacy-maximal re-hosting**: Unsplash requires it. Readers' browsers
  load those images from Unsplash's CDN, which sees their IP. The privacy policy (Phase 5) must say
  so. Unsplash is not an ad network and sets no cookies on image requests.

## Known gaps / follow-ups

- Seed stories are short essays (150–335 words); add a few 1,500+ word pieces when the table of
  contents lands.
- Not built yet from the spec's Writing/Reading lists: embeds, version history, series, draft
  sharing, import, table of contents, keyboard shortcuts and listen mode (later phases).
- Removed or replaced images stay in storage; a cleanup job for orphaned uploads is needed before
  launch. Uploaded images skip Next's image optimizer.
- `drizzle-kit generate --custom` can reuse a timestamp from a migration generated the same second;
  Supabase treats equal timestamps as one version, so rename the newer file (and its journal tag).
- `'use cache'` listings don't know about seed runs: restart `npm run dev` after `npm run db:seed`.
  Phase 1 publish actions must call `revalidateTag("stories")` and the story/profile tags.
- Story/profile 404s inside Suspense are soft 404s (HTTP 200 + noindex). Revisit with
  `generateStaticParams` for popular stories in Phase 1.
- Some corporate mail scanners prefetch links and can burn a magic link. If reported, switch
  `/auth/confirm` to a confirm-button page.
- Google sign-in doesn't yet save the reader's locale on first sign-in (magic links do).
- Turnstile on sign-up, rate limits and new-account limits are not in yet (spec: Trust & safety).
  That includes a per-writer limit on photo searches; today only caching protects the Unsplash quota.
- Changing a username breaks old `/@old/...` links; add redirects from previous usernames.
- Phase 2 leftovers: reading lists beyond one "Saved" list, undoing sparks, editing responses, blocking and
  muting, rate limits, deleting or transferring circles, a decline note for writers, and circle RSS.
- Unsplash thumbnails in lists show without a credit line (the credit is on the story page). Check
  this is acceptable when applying for Unsplash production access.
- A long-running `next dev` can lose track of routes after many new route folders are added (all
  `/@…` pages 404 with no error). Restart the dev server if that happens.
- Resend's free tier caps sends at 100/day (sign-in links included), so the summary job stops at 80 a
  run: about 560 readers with new activity a week. Past that, some summaries slip a week (logged as
  "daily summary cap reached"). Resend Pro is a paid service: ask before switching, then raise
  `EMAIL_SUMMARY_DAILY_LIMIT`. Readers can't pick their summary day yet.
- Summary emails list stories by title only; no story images in email (would need hosted copies of
  Unsplash images or hotlinks that some clients block).
- E2E runs against `npm run dev` locally (magic links only redirect to port 3000) and against the
  production build in CI.
