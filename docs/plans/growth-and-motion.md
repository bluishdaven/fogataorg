# Growth features and motion (2026-11-12)

Status: built 2026-11-12 (see CHANGELOG), including the founding writer badge the owner defined
the same day: the first 100 writers with five published stories.

The owner asked for every product gap from the growth review, plus motion where it helps. Writers
first: they bring readers through the share tools that already exist.

## 1. Writer stats (`/me/stats`, `/me/stats/[id]`)

- Reads have been recorded since 2026-11-07 (`read_events`); nothing showed them. New
  `security definer` functions, callable by `authenticated`, scoped to `auth.uid()`'s stories:
  - `writer_daily_reads(days, story)`: per UTC day, views (any visit), reads (past half) and
    seconds spent by readers who read.
  - `writer_story_totals()`: per story, views, reads, average reading time, sparks, sparkers,
    responses from others, saves and readers who kept an ember.
  - `writer_read_depth(story)`: how far visitors got, in quarters.
  - `writer_loved_passages(story)`: paragraphs that **two or more** readers highlighted, with
    the count. Never who, never which words (the writer sees their own paragraph).
- Overview: last 30 days vs. the 30 before (views, reads, read ratio, average time, new
  followers), a daily chart, a per-story table. The story view adds read depth and loved passages.
- Privacy policy: writers see totals, saves counts and highlighted paragraphs (2+ readers).

## 2. Featured weekly spark entries

- `prompt_features` (Drizzle): one row per featured story, admins insert/delete (RLS), anyone
  reads. Triggers: the story must answer that spark; at most three per spark; the writer gets a
  `featured` notification (no actors, like badges).
- `/prompts/[week]` shows Featured first (ember glow); admins get a Feature toggle per entry.
  The home's weekly spark lists last week's featured entries. Story pages say "Featured".

## 3. Visitor invitation

- Signed-out readers see a warm card after the author card: what Fogata is, Join (back to the
  story after sign-in), the manifesto.

## 4. RSS and the embed card

- RSS 2.0 at `/rss/@<username>.xml`, `/rss/circles/<slug>.xml`, `/rss/topics/<slug>.xml` (the
  extension keeps them out of the proxy). Excerpts, not full text: writers' work stays on Fogata.
  No NSFW stories. Discovery links on profile, circle and topic pages.
- `/embed/<handle>/<slug>`: a standalone HTML card (title, excerpt, writer, reading time, "Read on
  Fogata") for iframes. The proxy lets `/embed/` through untouched; it is the one path without
  `X-Frame-Options` and sends `frame-ancestors *`. Share menu: "Copy embed code".

## 5. Motion

All CSS (no new dependency), off under `prefers-reduced-motion`, never over story text:
- Publish moment: after a first publish, the story opens with a "Your story is live" dialog
  (rising sparks, share links, link to stats). Growth loop 2 from the spec.
- Stats: numbers count up, chart bars rise in sequence.
- Featured entries: a slow ember glow around the card.
- Visitor card and weekly spark: a few embers drift up from the flame.
- Notification bell: rings once when a new notification arrives.
- Embed card: the flame flickers.

## Risks

- `ALTER TYPE … ADD VALUE` must commit before use: the enum value is in the generated migration,
  the trigger that uses it in the next one.
- Header `source` regex for "everything but /embed/" must be checked in a production build.
- Stats queries scan `read_events` by story; add an index on `(story_id, day)`.
