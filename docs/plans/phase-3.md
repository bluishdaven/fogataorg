# Phase 3 (rest): onboarding, home feeds, Burning now

Search and topic pages shipped earlier. This adds the rest of the spec's Discovery list:
onboarding, the three home feeds, trending ("Burning now" / "Lo que arde") and the new-voices
boost.

## Onboarding (`/[locale]/welcome`)

New accounts land here after their first sign-in (`profiles.onboarded_at` is null). Existing
accounts are marked as onboarded by the migration.

1. **Languages**: the UI language (saved to `profiles.locale` and the cookie) and the languages they
   read (`profiles.reading_languages`, Spanish and/or English, both by default). Feeds use it.
2. **Topics**: pick at least three (they become topic follows).
3. **Writers**: suggestions from those topics (most sparked writers over the last 90 days, plus a
   few newer voices), each with a Follow button.

"Skip for now" is always there; skipping or finishing sets `onboarded_at`. `/auth/confirm` and
`/auth/callback` send people who haven't onboarded to `/welcome?next=…`; the For you tab shows a
"Pick a few topics" card until they do.

## Home feeds (`/?feed=`)

- Signed out: **Latest** (default) and **Burning now**.
- Signed in: **For you** (default), **Following**, **Burning now**, **Latest**.

The tab bar and list sit inside `<Suspense>` (they read cookies and search params); the headline
stays static.

- **Following**: stories from followed writers, topics and circles (accepted submissions), newest
  first.
- **For you**: the last 30 days in the reader's languages, scored by freshness, followed writers,
  topics and circles, how much the story is burning, and a boost for new voices. Leaves out the
  reader's own stories. Falls back to Burning now and Latest when follows are thin, so the feed is
  never empty.
- **Burning now**: activity over the last 72 hours (sparkers, responses, saves, reads past half
  the story) with time decay, in the reader's languages. Cached for 15 minutes (`'use cache'`, no
  cron needed). An empty window widens to 14 days, then falls back to Latest.
- **New voices**: stories from writers with three or fewer published stories, in their first week,
  get a boost in For you and Burning now (the spec: "writers feel seen fast").

All feeds use `notModerated` and the usual listing rules.

## Reads (`read_events`)

Trending counts reads that got past half the story. The story page sends one beacon to
`POST /api/reads` when the reader passes 50% and again when they leave (furthest point, seconds).
The server stores `viewer_hash` = HMAC of the day plus the person's id (or IP + user agent when
signed out), so no IP is stored and reads can't be linked across days. One row per story, viewer
and day (the upsert keeps the furthest point). Writers' own reads aren't counted. Written only by
`record_read()` (security definer, live stories only); no table grants. Kept 13 months for the
writer stats dashboard later (pruned by the daily cron).

The privacy policy gets a paragraph about it (EN + ES).

## Risks

- Feed queries scan 30 days of stories with several subqueries: fine at this size; revisit with a
  materialized score table if they get slow.
- Dates still render in UTC: story pages are cached for everyone, so a reader time zone needs more
  thought than an onboarding field.

## Tests

Unit (viewer hash, feed tab rules), db (`record_read`, grants, onboarding columns), e2e (a new
account goes through onboarding and sees its topics in For you; a story with fresh sparks shows in
Burning now; signed-out visitors get Latest and Burning now).
