# Changelog

## Fogata as an app (2026-11-12)

**Demo**: open **Get the app** in the footer and install Fogata (Chrome/Edge/Android: Install
button; iPhone: Share → Add to Home Screen). Save a story, turn on airplane mode and open it again.
In Settings → Notifications, switch on **Notifications on this device** and have someone follow you.

- **Installable**: a web app manifest, app icons (any, maskable, status-bar badge) and the
  "Fogata on your phone" page (`/app`) with the browser's own install button or Safari's steps.
- **Read offline**: a service worker keeps saved stories on the device. Saving a story keeps it,
  unsaving lets it go, opening a saved story refreshes an old copy, and **Keep saved stories
  offline** on the Saved page downloads the newest 50. Without a connection, any other page shows
  **Read offline** with what the device has. Signing out removes the copies.
- **Push notifications**, opt-in per device: the same words and links as the bell, one
  notification per group (new people joining replace it quietly), in the device's language.
  Sent when the action that caused them happens, and by the daily job for scheduled-story badges.
  Needs the VAPID keys in Vercel (docs/SETUP.md); hidden until they're set.
- The privacy policy and the data download cover push devices and offline copies.

## Founding writers (2026-11-12)

- The first 100 writers to publish five public stories get a numbered **Founding writer** badge
  (*Pluma fundadora*), kept for good: a gold seal after their name, a chip on their profile and a
  notification when they earn it. The badge guide shows how many of the 100 places are left.
  Writers who already had five stories when this shipped were numbered in the order they got there.

## Writer stats, featured sparks, RSS, embeds and a warmer welcome (2026-11-12)

**Demo**: publish a story for the first time: it opens with **Your story is live** (sparks rise,
share links, a link to its stats). Open the account menu → **Stats** for the last 30 days, a
day-by-day chart and every story's numbers; open a story for how far readers got and the lines
they loved. Sign out and open a story: an invitation to join waits under the writer's card.

- **Writer stats** (`/me/stats`): visits, reads (past half), read ratio, average reading time and
  new followers against the 30 days before; a chart you can hover or step through with the arrow
  keys (or read as a table); sparks, responses, saves and embers per story. Per story: how far
  visitors got and **Lines readers loved** (paragraphs two or more readers kept as embers). Totals
  only, never who; the privacy policy says so.
- **Featured weekly spark entries**: admins pick up to three entries on a spark's page; they show
  first with a slow ember glow, the writer gets a notification, the story says "Featured in the
  weekly spark" and the home page lists last week's featured entries.
- **Join invitation** for signed-out readers at the end of every story, bringing them back to it
  after sign-in.
- **RSS** for writers (`/rss/@handle.xml`), circles and topics, with excerpts only (the story stays
  on Fogata). Profile, circle and topic pages link to them.
- **Embed card**: **Share → Copy embed code** gives an iframe of a "Read on Fogata" card (light or
  dark, no scripts). Only `/embed/` pages can be framed by other sites.
- **Motion** (off under reduced motion, never over story text): counting numbers and rising chart
  columns, the publish moment, drifting embers on the weekly spark and the invitation, the featured
  glow, the bell ringing once when something new arrives, and a flickering flame on embeds.

## Quote cards in Story size, with the cover (2026-11-09)

- **Quote card** now opens the same preview dialog: choose **Post · 4:5** or **Story · 9:16**
  (Instagram's safe zones kept clear), add the story's cover (off by default) and use the story's
  color (on when the writer chose one). The passage link is still copied in the same tap.

## Story colors and a better Stories image (2026-11-09)

**Demo**: publish a story and pick a **Story color**. The story page shows it as a thin line above
the title and in the reading progress bar. **Share → Image for Stories** now opens a preview with
options: include the cover, use the story's color, and how much of the story to show (S/M/L).

- **Story color** (optional): presets or any color, chosen in the publish dialog next to the cover.
  It colors the Stories image and quote cards (white or black text, whichever reads), and the link
  preview card for stories without a picture.
- **Image for Stories** dialog, for stories and circles: a live preview, then Share (phones) or
  Download; the link is still copied for the link sticker. The cover shrinks to a banner to make
  room for longer previews.
- Covers and circle headers from Unsplash can now go into these images too, loaded from Unsplash
  with "Photo: name / Unsplash" printed under them.

## Continue reading removed (2026-11-07)

- No more "Pick up where you left off" on story pages or **Continue reading** on the home page, and
  story pages no longer save where readers stop (in their account or their browser).
- The places saved before were deleted (the `reading_positions` table is dropped), and they're gone
  from the data download and the privacy policy.

## Better voices in listen mode (2026-11-07)

Later the same day: the **Listen** button is in the ember colors, the player shows a small fire
with rising sparks and a warm glow while it reads (embers when paused; still for reduced motion),
and reading starts at 0.8× by default. Also fixed: the sepia theme was being washed out by a
Tailwind filter that shared its class name.

**Demo**: press **Listen** on a story, then the waveform button in the player: pick any voice your
browser offers for the story's language. The choice is remembered.

- By default listen mode now picks the most natural voice on the device (Apple's Enhanced and
  Premium voices, Microsoft's Natural ones, Google's) instead of the device's default, and never
  the robotic or sound-effect voices.
- Online voices (Chrome's Google voices, Edge's Microsoft Natural voices) are listed separately
  and only used when a reader picks one; the menu says the browser then sends what's being read to
  that company. The privacy policy says so too. No paid voices.

## Circle images for Stories (2026-11-07)

**Demo**: open any circle and tap **Share**: besides the link and the networks, **Image for
Stories** makes a 1080×1920 picture of the circle, ready for Instagram, WhatsApp or Facebook
Stories, and copies the circle's link for the link sticker.

- Drawn in the browser like the story image: the circle's accent color (white or black text,
  whichever reads), its uploaded header picture if it has one (Unsplash photos are never baked
  in), name, description, story and member counts, its latest stories when there's room, and
  "Read the circle" with the address.
- The shared link has no language prefix (`fogata.org/circles/<slug>`), so each visitor lands in
  their own language. The image's copy follows the sharer's language.

## Reading lists, undo sparks, editing responses, mute and block, circle ownership (2026-11-07)

**Demo**: tap the bookmark on a story: it's saved, and a small menu lets you tick other lists or
start one (**Saved** shows a chip per list). Sparked by mistake? The little arrow next to the count
takes them back. Your own responses have **Edit**. On anyone's profile, **…** mutes or blocks them.
Circle owners find **Ownership** at the bottom of the manage page, and declining a story asks for
an optional note.

- **Reading lists**: up to 50 private lists next to Saved; a story can sit in several. Rename or
  delete a list on the Saved page. One save per reader still counts once in `story_heat()`.
- **Undo sparks**: takes back all your sparks on a story and removes you from the writer's unread
  spark notification.
- **Edit responses**: shown as "edited"; people mentioned for the first time in an edit are told.
- **Mute and block** (private, nobody is told): their activity never notifies you, their stories
  leave your home feeds and their responses fold away. Blocking also ends follows both ways and
  stops them following you, responding to, replying to or sparking your writing. Listed under
  Settings → Account; in the data download and the privacy policy.
- **Circles**: owners hand a circle to another member (who is told) or delete it after typing its
  name; stories stay with their writers. Editors can add a note when they decline a story; the
  writer sees it in notifications and the weekly email.

## Listen mode, continue reading, weekly spark, easy-to-read typeface (2026-11-07)

**Demo**: on any story, **Listen** reads it aloud and **Aa → Easy to read** switches to a
dyslexia-friendly typeface. Leave a story halfway and come back: "Pick up where you left off", and
the home page lists it under **Continue reading**. Admins set **Weekly sparks** in the account
menu; this week's shows on the home page with **Write about it**.

- **Listen mode**: the browser's own speech (free, on the device), paragraph by paragraph in the
  story's language, with the paragraph marked; pause, speed (0.8× to 1.5×) and stop.
- **Easy to read**: Atkinson Hyperlegible Next with more space between letters, words and lines,
  downloaded only by readers who pick it.
- **Continue reading**: signed-in readers' place in each story is saved to their account (any
  device; never their own stories); visitors' place stays in their browser. In the data download
  and the privacy policy.
- **Weekly spark** (La chispa de la semana): one prompt per week in English and Spanish, written
  ahead by admins and shown once its week starts. Drafts started from it say so (and can let go);
  published answers carry a chip and gather on the spark's page; past sparks are at `/prompts`.

## Import, series, contents, version history and two home tabs (2026-11-07)

**Demo**: My stories now has **Import stories** and **Series**. Upload a Medium, Substack or
WordPress export and pick posts to bring over as drafts. Group stories into a series and readers
see "Part 2 of 3" with the next part. In the editor, the clock button opens **Version history**.

- **Import**: the export is read in the browser; each chosen post becomes a draft with its
  pictures copied to Fogata (pictures that can't be copied stay as links), its language guessed
  and, optionally, a canonical link to the original. Nothing is published or announced.
- **Series**: create, rename, reorder and delete series on /me/series. Story pages show where a
  story sits and link the neighbors; each series has a page at `/@name/series/…`; profiles list
  them.
- **Table of contents**: stories with three or more headings get a Contents list under the header.
- **Version history**: one version per ten minutes of writing plus every publish (newest 50).
  Preview any version and restore it; the replaced text stays in the history.
- **Home tabs**: just **Latest** (the default; signed-in readers see the languages they read) and
  **Following**. For you and Burning now are gone from the home page; onboarding now lands on
  Following.

## Onboarding, home feeds, Burning now, embers and quote cards (2026-11-07)

**Demo**: sign up with a new address and you're asked for your languages, three or more topics
and a few writers; the home page then opens on **For you**, with **Following**, **Burning now**
and **Latest** beside it. In any story, select a few words: **Highlight**, **Respond**,
**Quote card** or **Copy link**. Your highlights live under **Embers** in the account menu.

- **Onboarding** (`/welcome`): languages you read, topics, suggested writers (new voices marked).
  Skippable; Settings → Account leads back to it. Existing accounts skip it.
- **Home feeds**: For you (follows, freshness, what's burning, new voices; never your own
  stories), Following (newest first), Burning now and Latest. Visitors get Latest and Burning now.
- **Burning now**: sparkers, responses, saves, embers and reads past half the story over the last
  days, fading by half every 36 hours.
- **Anonymous reading counts**: the story page notes how far a reader got under a code that
  changes daily (no IP stored, no cookie). The privacy policy says so.
- **Embers**: highlights you keep, private to you, marked in the story when you come back.
- **Quote cards**: a portrait image of the passage with the writer and story, shared on phones or
  downloaded, with a link to the passage copied in the same tap.
- **Passage links** open the story at the paragraph, which glows; most browsers also mark the
  exact words.

## Ready for launch: legal pages, your data, abuse limits, real 404s (2026-11-07)

**Demo**: the footer links **Terms**, **Privacy** and **Content policy**; Settings → **Account** has
"Download my data" and "Delete my account"; `fogata.org/@nobody_here` answers with a 404; change
your username and your old links still open your profile and stories.

- **Legal pages** in English and Spanish, written to match what Fogata actually does (contact
  hola@fogata.org). The sign-in form links to the terms and privacy policy.
- **Your data**: one JSON download of your profile, stories (with drafts), responses, sparks, saved
  stories, follows and circles. Deleting your account removes your uploaded files and everything
  tied to you, right away.
- **Abuse limits**: hourly and daily caps on publishing, responses, new circles, join requests,
  follows and photo searches, lower on an account's first day; sign-in links are capped per
  address. An optional Cloudflare Turnstile check on sign-in once its keys are set.
- **Real 404s** for missing stories and profiles (and stories that aren't public), so search
  engines and link previews see them as gone.
- **Old usernames redirect** to the new one, and stay reserved for their owner (the newest five).
- **Unused uploads** (pictures dropped from stories, replaced covers, deleted stories' pictures)
  are removed by the daily job once Supabase's secret key is set in Vercel.

## Manifesto, Fogata.org wordmark, Stories link (2026-11-06)

**Demo**: the footer now links to the **Manifesto** next to Topics; the header reads "Fogata.org";
"Image for Stories" copies the story's link as it makes the image.

- **Manifesto** in English and Spanish, in the founder's voice and signed Fogata.org: reading comes
  first, a .org not an ad network, your words are yours, everyone gets everything, quiet by design,
  two languages one flame, new voices burn too. In the sitemap with hreflang links.
- **Wordmark**: a quiet, greyed ".org" after Fogata in the header.
- **Stories image**: the link is copied in the same tap, with a note to paste it into a link
  sticker (Instagram doesn't take links from shared images).

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

## UI audit: keyboard focus, dialogs, layout shift and JS size (2026-11-05)

**Demo**: on the home page press Tab a few times. Story cards now show an ember outline, as do
every button and field. Open a badge on a profile and press Escape: focus goes back to the badge.
Open a story on a phone-sized window: the footer no longer jumps.

- **Keyboard**: visible 2px focus outlines everywhere, which were missing on story cards and at
  1.8:1 elsewhere. Focus stays clear of the sticky header and returns to the opener when any dialog
  closes.
- **Screen readers**: form errors are read with their field, the editor has a heading, and its
  phone back link has a name. The toast region is named in the reader's language, and badge chips
  no longer repeat their name.
- **Contrast**: hovered primary buttons and the editor's hints pass AA in all three themes.
- **Performance**: the story page's mobile layout shift went from 0.24 to 0.001. The Supabase
  client loads after hydration, about 66 KB less JS on every page.
- **Live bell**: the unread count now really updates without a reload. The Realtime subscription
  had been refused because it joined before the session token was set.
- Open items, ranked, in `docs/plans/ui-audit.md`: paragraph responses need a keyboard path; input
  borders and font loading need the owner's call.
- Tests: unit (dialog focus return, badge chip names, reduced-motion scroll) and Playwright
  (keyboard focus in 3 themes, hover contrast, axe on the editor and account pages at phone width,
  live bell, Spanish toast region).

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
