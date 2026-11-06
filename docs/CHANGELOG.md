# Changelog

## Picture sizes (2026-11-06)

**Demo**: in the editor, every picture has **S / M / L / W** buttons on its corner (Small, Medium,
Large, Wide; P / M / G / A in Spanish). Pick one and the published story matches.

- Small and Medium sit centered in the column; Large fills it (what every picture did before);
  Wide breaks out of it.
- Tall pictures start at Medium, and no picture is ever taller than 85% of the screen: tall ones
  narrow instead of filling the column.
- Existing stories keep their pictures at Large until the writer picks another size.

## Protecting writers from scrapers (2026-11-06)

**Demo**: `fogata.org/robots.txt` now names the AI training crawlers it turns away; every story ends
with "© 2026 Writer. All rights reserved."; `fogata.org/.well-known/tdmrep.json` exists.

- **Closed the bulk-download hole**: Supabase's public table API (REST and GraphQL) answered anyone
  holding the publishable key, which ships in the site's code, so every published story could be
  downloaded in one request. It now refuses every request (403). Sign-in, photo uploads and the live
  bell use other Supabase services and keep working.
- **AI training crawlers turned away** in robots.txt (OpenAI's GPTBot, Anthropic's ClaudeBot,
  Google-Extended, Common Crawl, Applebot-Extended, Meta, ByteDance and others). Google and Bing
  search, link previews and AI search tools that link back are still allowed.
- **Rights reserved, machine-readably**: the W3C TDM Reservation Protocol on every response, page and
  `tdmrep.json` (the opt-out EU copyright law recognizes), plus `noai, noimageai`.
- **Copyright line** under every story and in its structured data.
- **Fix**: a first story's badge notice could slip to the next day when the web server's clock ran
  ahead of the database's; immediate publishes now use the database's clock.
- Tests: 189 unit, 76 RLS, Playwright for the headers, tdmrep.json, the copyright line and the
  closed REST/GraphQL APIs.

## Circle previews and SEO (2026-11-06)

**Demo**: share a circle link: it previews with the circle's header image, or a card with its name
on its accent color. Open `fogata.org/sitemap.xml` and `fogata.org/robots.txt`.

- **Circle previews**: Unsplash headers are hotlinked as a JPEG crop; uploaded headers are converted
  to JPEG; no header gets a circle card with the flame and fogata.org.
- **Sitemap and robots**: every public story, writer, topic and circle with stories, with Spanish and
  English versions of the localized pages. Private areas and APIs stay out (share images stay
  reachable); preview deployments ask crawlers to stay away entirely.
- **Canonical and language links** on the home, topics and circles pages, so Google shows the right
  language version.
- **Structured data**: stories as articles (headline, writer, date, picture, language, word count,
  topics), profiles as profile pages, and the site name and logo on the home page.
- **Thin pages stay out of results** until they have something to show: profiles, topics and circles
  without stories are noindex (links on them are still followed).
- Tests: 187 unit, 76 RLS, Playwright for robots/sitemap, language links, structured data, empty
  profiles and the circle preview.

## Profile extras and share previews (2026-11-06)

**Demo**: Settings → Profile now has **Pronouns**, **Now** (Reading / Watching / Listening to, plus
what it is) and **Influences** (books, movies and shows, music, politics; one per line). Profiles
show them, with "12 stories · 18,450 words". Paste a fogata.org link, a story or a profile into
WhatsApp, X or iMessage to see the new previews.

- **Pronouns** sit next to the @handle on profiles and after the name in story cards, the story
  byline, the writer card and responses. The writer card also shows the Now line.
- **Influences are searchable**: searching "casa de los espiritus" finds people who list "La casa de
  los espíritus", and the result says where ("Books: …").
- **Word counts** are counted by the database from the published text, so they can't be faked and
  edits only count once published.
- **Share previews**: the site link shows the flame card; stories show their picture (Unsplash
  pictures hotlinked as required, uploaded ones as JPEG) or a card with the title and writer;
  profiles show a card with photo, name, bio and counts. All say fogata.org.
- Tests: 182 unit, 76 RLS (word counts match the app's, generated and unforgeable, profile limits
  and ownership), Playwright for the settings → profile → previews flow and the uploaded-picture
  preview. The summary email test now expects the Kindling badge notice next to the follow.

## Private circles, badge explainer and badge notifications (2026-11-05)

**Demo**: start a circle and choose **Private** under "Who can publish" (or switch it in Manage →
Details). From another account, open it: it's still listed and readable, marked "Private circle",
with **Request to join** instead of "Submit a story". The owner gets a bell notification and accepts
or declines under **Requests to join** on the manage page. On any profile, tap a badge chip.

- **Circle owners**: the creator is the owner, with every editor power plus adding and removing
  people. Owners and editors decide on join requests and can switch a circle between public and
  private.
- **Private circles**: only members submit (enforced by RLS). Accepted people join as writers, so
  their stories go straight in. People can cancel a waiting request; a declined request can't be
  sent again (the owner can still add the person by username). Requests to the same circle group in
  the bell ("Ana and 2 others asked to join…").
- **Badge explainer**: tapping a badge on a profile explains it and lists all ten writing tiers and
  the donor badge, marking the ones earned and how many stories the next tier takes.
- **Badge notifications**: a new writing tier or a donor grant rings the bell (and is in the weekly
  summary). Each tier is announced once; scheduled stories are covered by the daily job. The donor
  badge is now a heart in flames.
- Tests: 170 unit, 73 RLS (private submissions, request/decide rules, grouping per circle, tier
  announcements), 80 Playwright (private-circle flow, the badge dialog in three themes, the
  first-badge notification).

## Story moderation, and two-month donor badges (2026-11-05)

**Demo** (as an admin): open any story → the **Moderation** bar under the header → **Mark NSFW** or
**Remove story**, with a reason readers will see. **Moderation** in the account menu lists moderated
stories, lets you lift moderation and shows a log of every action.

- **Removed** stories show "This story was moderated / Moderated for: …" at their address, leave every
  list and no longer count toward the writer's badge tier. Writers see the reason in Your stories.
- **NSFW** stories open behind a content warning that states the reason; no picture in link previews
  or lists, not indexed, and off the home feed, topics, circles and search (still on the writer's
  profile and in readers' saved lists, labelled).
- **Donor badge** is temporary again: two months per grant, stacking when renewed early. Donors see
  their end date in Settings → Profile; the admin list shows "active until" or "ended".
- Tests: 153 unit, 65 RLS (admin-only moderation, authors can't undo it, tier counts), 73 Playwright
  (NSFW warning, removal notice, lift; donor grant with end date).

## Badges (2026-11-05)

**Demo**: badges sit right after names in story lists, bylines, the writer card, responses, search,
circle members and the account menu; profiles show labeled chips.

- **Writing tiers**, by published public stories: Kindling/Yesca (1), Candle/Vela (5), Flame/Llama
  (12), Torch/Antorcha (25), Hearth/Hogar (50), Bonfire/Hoguera (100), Beacon/Faro (200),
  Star/Estrella (350), Sun/Sol (600), Phoenix/Fénix (1,000).
- **Firekeeper / Mecenas** donor badge, permanent until removed, granted by the owner at
  `/admin/donors` (by @username or sign-in email, with a private note and a log).
- Tests: 150 unit, 60 RLS (admin-only grants, private log, count rules), 72 Playwright (grant and
  remove as owner, badges in both languages).

## Stories image (2026-11-05)

**Demo**: open any story → share → **Image for Stories**. A 1080×1920 image with the Fogata flame,
the title, the writer, a few lines of the story and "Read the full story" (or "Lee la historia
completa" for Spanish stories). On a phone it goes straight to the share sheet (Instagram, WhatsApp
status…); on a computer it downloads.

- Drawn in the browser with the site's fonts; no server work. The writer's photo appears when set.
- The share menu now opens on phones too (with "Share via…" for the system sheet), and menu items
  everywhere are 44px on phones.
- Tests: 141 unit (layout, wrapping, title fitting), 54 RLS, 70 Playwright (downloads a 1080×1920 PNG).

## Topics in production, a share button and photo search (2026-11-05)

- **Topics**: a 39-topic catalog (EN + ES) now ships as a migration, so the publish dialog has topics
  in production too (it used to depend on the demo seed). Topic chips are touch-sized.
- **Share**: a share button in the story's floating bar. Phones get the system share sheet; desktops
  get copy link and WhatsApp, X, Facebook, LinkedIn, Threads, Telegram and email. Stories without a
  cover now use their first picture in link previews.
- **Photo search**: production needed `UNSPLASH_ACCESS_KEY` in Vercel (no code change).
- Tests: 133 unit, 54 RLS/storage/job, 69 Playwright (copy link, network links, Spanish menu).

## Profile photos and a touch-friendly refresh (2026-11-05)

**Demo** (signed in): **Settings → Profile** → **Upload photo**. Any photo is cropped to a square
and shows next to your name in the header, on your profile, in bylines, story lists, search and
responses. **Change photo** replaces it (the old file is deleted); **Remove** brings your initials back.
On a phone, every button and field is now a comfortable 44px, with pill-shaped buttons, a new byline
with the writer's photo, larger topic tags and a writer card.

- `avatars` storage bucket (own folder, WebP, 1 MB) and a database check that a profile photo URL
  points into its owner's folder.
- Buttons, inputs, header controls, story actions, response actions, topic chips, footer links and
  settings tabs meet 44px (or 40px with spacing) on phones; desktop stays compact.
- Tests: 131 unit, 53 RLS/storage/job, 67 Playwright (upload, crop, replace with cleanup, remove,
  non-photo files, axe on settings).

## Phase 2, part 3 — Email summaries (2026-11-05)

**Demo** (signed in): avatar menu → **Settings** → **Email** shows **Weekly summary** (on by default,
with the weekday yours arrives) or **Off**. Fogata sends nothing else besides sign-in links. Get a
follow or a spark from a second account, wait 10 minutes (or age the notification), set your
`profiles.email_weekday` to today's UTC weekday in Studio, then run the job: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/notification-emails`.
The summary arrives in Mailpit (http://127.0.0.1:54324) in your language, with links to each story
and an **Unsubscribe** link that asks for confirmation.

- Resend in production, Mailpit locally; React Email template sharing the notification wording with
  the in-app list.
- `profiles.email_frequency` (weekly or off), `email_weekday` (random per reader, phases sends across
  the week), `email_last_sent_at`; `notifications.emailed_at`. A group that gets a new
  actor after being emailed is due again; marking notifications read or emailed no longer changes
  the time shown on the notifications page (that was a bug: opening the page re-dated everything).
- Daily Vercel Cron (`vercel.json`) emails that weekday's readers, at most 80 a run (Resend's free
  tier is 100/day); protected by `CRON_SECRET`; one-click unsubscribe headers.
- Tests: 122 unit, 50 RLS/trigger/job, 61 Playwright (cron → Mailpit → unsubscribe, one-click POST,
  tampered tokens). Also fixed two e2e flakes (same-millisecond circle names, `/` before hydration).

## Phase 2, part 2 — Circles (2026-11-05)

**Demo** (signed in): footer → **Circles** → **Start a circle**. Pick a name, an accent color (text
on it is always readable) and an optional header photo. On the circle page, **Submit a story** offers
one of your published stories; editors get a notification and accept or decline it under **Manage**,
where the owner can also add editors (who review) and writers (who skip review) by username. Accepted
stories appear on the circle page and show "Published in …" on the story. Readers can follow circles,
and search finds them.

- Tables: `circles`, `circle_members`, `circle_submissions`; follows and notifications extended.
- Notifications for new submissions (to editors) and decisions (to the writer), with the circle's name.
- Tests: 114 unit (including accent contrast across all grays), 40 RLS/trigger, 59 Playwright (two-user
  submission and review flow, manage-page access, axe on circle pages).

## Phase 2, part 1 — Social, search and thumbnails (2026-11-05)

**Demo** (restart `npm run dev` first; signed in):

1. The home page, profiles, topics and search show a thumbnail of each story's cover or first picture.
2. Click the search icon (or press `/`) and search stories, people and topics. Accents and small
   typos don't matter ("manana", "libreria", "herron"); filter stories by language.
3. Open someone else's story. The floating bar lets you spark it (tap up to 50 times), jump to
   responses and save it. Follow the writer from the card at the end.
4. Respond to the story, or select a few words in a paragraph and tap **Respond** to answer that
   paragraph. Mention people with `@username`. Writers can reply, pin a response and see a "Writer"
   badge on their replies; paragraphs with responses get a small marker.
5. The bell in the header counts unread notifications live; **Notifications** groups them
   ("Ana and 3 others sparked your story"). **Saved** (avatar menu) lists stories you kept.
6. Follow topics from their pages; follower counts appear on profiles.

**What's in**

- Story thumbnails (set on publish, backfilled) and lighter listing queries.
- Search: generated tsvector with Spanish/English stemming and accent folding, trigram similarity.
- Follows, sparks, saved stories, responses (threads, paragraph anchors, mentions, pinning, sparks)
  and grouped notifications written by database triggers, live via Supabase Realtime.
- Seed stories now carry stable block ids, so paragraph responses work on them too.
- Tests: 109 unit, 33 RLS/trigger, 57 Playwright (two-user social flow, paragraph responses, search).

**Not yet:** circles and email notifications (see `docs/plans/phase-2.md`).

## Phase 1 — Write and read (2026-11-05)

**Demo** (signed in, after `npm run dev`):

1. Click **Write** in the header. Type a title, a subtitle and a few paragraphs. "Saved" appears in
   the top bar a moment after you stop typing; reload and everything is still there.
2. On a new line type `/` for headings, quotes, pull quotes, callouts, lists, code, dividers, an image
   upload or an Unsplash photo. Select text to bold, italicize, link or turn it into a heading.
3. Paste or drop a photo. It's resized in your browser, uploaded, and asks for alt text.
4. Click **Publish**: add a cover (upload or Unsplash), up to 5 topics, the story's language, who can
   find it, and publish now or schedule it. Search title, description and original URL live under
   "Search and sharing details".
5. The story opens at `/@you/your-title` and shows on the home page, your profile and its topics.
6. Edit it again: changes stay private until **Publish changes**. **Your stories** (avatar menu) lists
   drafts, scheduled, published and link-only stories.
7. On any story, **Aa** sets text size, typeface, line width and theme; a thin ember bar shows
   progress. **Settings** edits your name, username, bio and links. **Topics** (footer) lists stories
   by topic.

**What's in**

- Tiptap 3 editor with figures (alt text, captions, wide or inset, Unsplash credit), pull quotes,
  callouts, stable block IDs, Markdown shortcuts, `/` menu and selection toolbar.
- Autosave with revision checks, local backup and retry when back online; private pending edits for
  live stories; publish, schedule, unlist, unpublish and delete.
- Server-side document allowlist on every save; render-time image host allowlist.
- `story-images` storage bucket with per-writer folders.
- Story pages: cover with credit, topic links, SEO title/description, cover as link-preview image.
- Reader controls and progress bar; profile settings with links (`rel="me"`); topic index and pages.
- Tests: 103 unit/component, 22 RLS (including storage), 52 Playwright (writing, publishing,
  scheduling, live edits, settings, topics, reader controls, axe scans of signed-in pages in three
  themes).

**Fixed along the way**

- Signed-in pages tripped a prerender error (session checks read the clock); they now run per request.
- Account and language buttons now include their visible text in their accessible names.

## Unsplash photo search (2026-11-04)

**Demo**: add `UNSPLASH_ACCESS_KEY` to `.env.local` (see `docs/SETUP.md`), restart `npm run dev`,
sign in, open `/en/design` → Image search → **Search Unsplash**. Type or tap a suggestion, pick a
photo, and it appears as a figure credited "Photo by … on Unsplash".

- Picker dialog with debounced search, suggestions, masonry results with color placeholders,
  "More photos", keyboard and screen-reader labels, and clear messages for signed-out,
  not-configured and rate-limited states. Spanish and English UI.
- Server-side proxy (`/api/unsplash/search`): signed-in only, Zod-validated, results cached for
  hours so writers share the hourly quota.
- Follows Unsplash's API guidelines: hotlinked and resized images that keep `ixid`, a download
  event when a photo is picked, and photographer credit with referral links.
- `stories.cover_alt` and `stories.cover_credit` columns, ready for the Phase 1 publish flow.
- Tests: 21 unit/component, 1 RLS, 4 e2e (including a check that sign-in returns writers to the
  page they came from).
- Copy: Fogata is no longer described as a "bilingual platform" in the UI or README; language
  support is unchanged.

## Phase 0 — Foundation (2026-11-04)

**Demo** (after `npm run setup && npm run dev`):

1. Open http://localhost:3000. You land on `/en` or `/es` depending on your browser language.
2. The home page lists 17 published stories from 8 writers, in Spanish and English. Drafts and
   the unlisted story don't appear.
3. Open any story. The URL is the share URL (`/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta`)
   and the UI around it follows your language choice; the story keeps its own `lang`.
4. Switch language and theme (light, dark, sepia) from the header. Both stick across reloads.
5. Sign in from the header with any email; open the link from Mailpit (http://127.0.0.1:54324).
   You come back signed in with a profile created from your email. Sign out from the avatar menu.
6. `/en/design` is the living style guide: tokens, type scale, reading measure, components and
   the campfire vocabulary.

**What's in**

- Next.js 16.4 (App Router, Cache Components), TypeScript strict, Tailwind 4, shadcn/ui on Radix.
- Design tokens for light, dark and sepia; Source Serif 4 for reading, Inter for UI; animated flame
  that respects reduced motion.
- next-intl with `/en` and `/es` UI routes and unprefixed `/@handle` share URLs.
- Supabase Auth: magic link (token-hash, email templates in ES and EN) and Google (behind a flag).
- Drizzle schema and migrations for `profiles`, `topics`, `stories`, `story_topics`, with RLS
  policies, column grants, a sign-up trigger, and a 5-topic limit.
- `withRls()` so every app query runs under Supabase roles.
- Seed: 8 fictional writers, 14 topics (names in ES and EN), 20 original stories (10 ES, 10 EN; 17 published,
  2 drafts, 1 unlisted). Refuses to run against a non-local database.
- Tests: 59 unit/component, 16 RLS, 38 Playwright (including the full magic-link flow and axe
  WCAG A/AA scans of six pages in all three themes).
- CI: lint, typecheck, unit tests, runtime dependency audit; RLS and e2e against a throwaway
  Supabase stack.

**Not yet**

- Vercel and Supabase cloud aren't connected (owner steps in `docs/SETUP.md`).
- See "Known gaps / follow-ups" in `CLAUDE.md`.
