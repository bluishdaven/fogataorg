# Fogata.org — Claude Code Build Prompt

Nov 4, 2026 · @Edgar Chavez

## How to use this prompt

Export this doc as Markdown, save it in an empty repo as `docs/PRODUCT_SPEC.md`, and start Claude Code with: *"Read docs/PRODUCT\_SPEC.md and start Phase 0. Follow the working rules at the end."* Everything below this section is written to Claude Code directly.

Defaults you may want to change before starting:

- **Stack**: Next.js + Supabase (Postgres, auth, storage). Swap only if you have a strong preference; the spec is written around it.
- **Language**: English-first UI with full Spanish support.
- **Hosting**: Vercel for the app, Supabase cloud for data. Both have free tiers good enough for launch.
- **Open question**: will Fogata ever pay writers (memberships, tips)? Phase 5 leaves room for it but builds nothing paid. - All users should be Pro, with donations enabled and encouraged for development to keep the platform alive.

## Role, vision and brand

You are a senior full-stack engineer and product designer building **Fogata.org**, a long-form reading and writing platform in the spirit of Medium. The goal is not a copy: it is a warmer, more social place where reading a story feels like sitting around a campfire, and sharing one feels natural.

**Product principles**

1. **Reading comes first.** Typography, speed and calm beat feature count. No pop-ups over text, ever.
2. **Every story is shareable by design.** Each story, quote and author page must look great when pasted into WhatsApp, X, LinkedIn, Threads or iMessage.
3. **Writers feel seen fast.** A new writer should get a first reaction within days, not months. Design discovery to give new voices a chance.
4. **Bilingual from day one.** Spanish and English are equal citizens: UI, stories, search and recommendations.
5. **A .org, not an ad network.** No ads, no selling data, no dark patterns. Growth comes from delight and sharing.

**The campfire vocabulary.** Use it lightly in the UI so it feels branded, never confusing. Show the plain meaning on first use (tooltip or onboarding).

| Concept | Fogata term (ES) | English UI |
| --- | --- | --- |
| Applause / like | Chispas | Sparks |
| Community / publication | Círculo | Circle |
| Saved highlight | Brasa | Ember |
| Reading list | Leña guardada | Saved |
| Trending | Lo que arde | Burning now |
| Weekly writing prompt | La chispa de la semana | Weekly spark |

**Visual identity.** Warm, dark-friendly palette: deep night blue and charcoal backgrounds, ember orange as the single accent, cream for light mode paper. A small animated flame for the logo and loading states. Generous serif for reading (e.g. Source Serif 4 or Literata), clean sans for UI (e.g. Inter).

## Tech stack and architecture

Use the latest stable versions at build time and pin them in `package.json`.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript strict | Server components, SSR for SEO and fast first paint |
| Styling | Tailwind CSS + shadcn/ui + Radix | Accessible primitives, easy theming |
| Editor | Tiptap (ProseMirror) | Block editing, slash commands, collaboration-ready |
| Database | Supabase Postgres | Relational data, full-text search, Row Level Security |
| ORM | Drizzle | Typed queries and migrations in the repo |
| Auth | Supabase Auth: magic link, Google, GitHub | No passwords to manage |
| Storage | Supabase Storage + image transforms | Covers, avatars, inline images |
| Realtime | Supabase Realtime | Live notifications and response threads |
| Search | Postgres `tsvector` (Spanish + English configs) + `pg_trgm` | Good enough to launch; Meilisearch later if needed |
| Email | Resend + React Email | Digests, follower notifications |
| OG images | `next/og` (Satori) | Dynamic share cards per story and quote |
| i18n | next-intl | ES/EN routes and messages |
| Analytics | Self-built read events + Plausible for traffic | Privacy-friendly, no cookies banner needed |
| Testing | Vitest, Testing Library, Playwright | Unit, component, end-to-end |
| Hosting | Vercel + Supabase cloud | Free tiers at launch |

**Architecture rules**

- Server components by default; client components only for interaction (editor, sparks, highlights).
- All writes go through server actions or route handlers with Zod validation.
- Row Level Security on every table. Never trust the client for ownership.
- Background jobs (digests, trending scores, OG pre-renders) via Supabase cron or Vercel cron.
- Keep a `/lib/domain` layer for business rules so UI and API never duplicate logic.

## Core features

### Writing

- **Distraction-free editor**: title, subtitle, body. Toolbar appears only on selection.
- **Slash commands** (`/`): headings, quote, pull quote, code block, divider, image, embed, callout.
- **Markdown shortcuts**: `#`, `>`, `**`, `-`, ```` ``` ```` convert as you type.
- **Media**: drag-and-drop or paste images, auto-compressed; captions; full-width and inset layouts.
- **Embeds**: YouTube, Vimeo, Spotify, X posts, GitHub Gists, CodePen, Google Maps via URL paste.
- **Autosave** every few seconds with a visible "Saved" state; works offline and syncs on reconnect.
- **Version history**: restore any earlier version of a draft or published story.
- **Publish flow**: cover image, topics (up to 5), language, SEO title and description, canonical URL for cross-posts, schedule for later.
- **Series**: group stories into an ordered series with next/previous navigation.
- **Share draft for feedback**: private link where friends can leave inline notes before publishing.
- **Import**: paste a URL or upload Markdown to import from Medium, Substack, WordPress or Ghost.

### Reading

- Clean story page: reading time, author card, publish date, topics, language badge.
- **Reading progress** bar and "continue where you left off" across devices.
- **Reader controls**: font size, serif/sans, light/dark/sepia, line width.
- **Listen mode**: browser text-to-speech with play/pause and speed.
- **Table of contents** auto-built from headings for long stories.
- **Highlights (embers)**: select text to highlight, add a private note, or share it.
- **Inline responses**: comment on a specific paragraph; a small marker shows where conversations happen.

### Social

- Follow writers, topics and circles.
- **Sparks**: up to 50 per reader per story, with a satisfying spark animation and haptic feedback on mobile.
- **Responses**: threaded, with mentions (`@user`), sparks on responses, author pinning, and "author replied" badges.
- **Circles**: community publications with editors, submission queue, custom header and accent color.
- **Notifications**: in-app (realtime) and email, grouped and batched ("12 people sparked your story") so they never spam.
- **Profiles**: bio, links, pinned story, stats (stories, followers), language, Fogata join date.

### Discovery

- **Home feed** with three tabs: *Para ti* (personalized), *Siguiendo* (following, chronological), *Lo que arde* (trending).
- **Topics pages** with top and latest stories and top writers.
- **Search** across stories, people, topics and circles, with language filter and typo tolerance.
- **Onboarding**: pick language, 3+ topics, then suggested writers to follow, so the first feed is never empty.
- **New voices boost**: every new writer's first stories get guaranteed exposure to a small, relevant audience.

## Engagement and sharing features

These features are the reason people choose Fogata over a plain blog. Treat them as first-class, not polish.

### Share-worthy by default

- **Dynamic OG images** for every story: cover, title, author avatar, reading time, Fogata flame. Separate formats for X/LinkedIn (1200×630) and WhatsApp/Instagram stories (1080×1920).
- **Quote cards**: select any sentence → "Share as card" generates a styled image of the quote with author and story title, downloadable or shareable.
- **Deep links to highlights**: shared links scroll to and glow the exact paragraph (use URL text fragments plus a fallback anchor).
- **Native share sheet** on mobile (Web Share API); one-tap buttons for WhatsApp, X, LinkedIn, Threads, Telegram, email and copy link on desktop.
- **"Read on Fogata" embed**: an iframe card writers can place on their own sites.
- **Author link-in-bio page**: `fogata.org/@name` doubles as a beautiful link hub.
- **RSS** per author, circle and topic.

### Reasons to come back

- **Weekly spark**: a writing prompt every Monday; responses are collected on one page and the best get featured.
- **Writing streaks**: gentle streak counter for writing days, never punishing. Shown only to the writer.
- **Reading streaks and year-in-review**: "Tu año en Fogata" in December with shareable stats cards.
- **Digest email**: weekly, personalized, with one-click unsubscribe and adjustable frequency.
- **"Continue reading"** and reading lists synced across devices; saved stories available offline (PWA).

### Writer delight

- **Stats dashboard**: views, reads, read ratio, average read time, sparks, follower growth, top referrers, and which paragraph readers highlight most.
- **Milestone moments**: first spark, first 10 followers, first 100 reads trigger a celebratory toast and a shareable badge card.
- **Fan reactions summary**: "Your story was highlighted 34 times; this is the line people loved most."
- **Newsletter mode**: followers can opt in to get a writer's stories by email.
- **Cross-post tools**: canonical URLs and an export button so writers never feel locked in.

### Growth loops to build in

1. Reader highlights a line → shares quote card → friend lands on the story at that paragraph → sees "Join to spark this" → signs up.
2. Writer publishes → gets OG-ready share links and a "Share your story" checklist → brings their own audience.
3. Weekly spark → many people write on one prompt → each shares their entry → readers browse other entries.
4. Invite links: writers invite friends to read a draft; guests can respond after a light sign-up.

## Data model

Starting schema. Use UUID primary keys, `created_at`/`updated_at` on every table, soft deletes where noted, and RLS policies for each.

| Table | Key fields | Notes |
| --- | --- | --- |
| `profiles` | id (= auth user), username, display\_name, bio, avatar\_url, links (jsonb), locale, is\_verified | Username unique, case-insensitive |
| `stories` | id, author\_id, circle\_id?, title, subtitle, slug, content (Tiptap JSON), content\_text, language, status (draft/scheduled/published/unlisted), published\_at, reading\_time, cover\_url, canonical\_url, series\_id? | Soft delete; `tsvector` column per language |
| `story_versions` | story\_id, content, created\_at | Version history |
| `topics` / `story_topics` | slug, name\_es, name\_en | Max 5 per story |
| `series` | author\_id, title, order | Ordered list of stories |
| `circles` / `circle_members` | name, slug, accent\_color; role (owner/editor/writer) | Submission queue on stories |
| `follows` | follower\_id, target\_type (user/topic/circle), target\_id | Unique per pair |
| `sparks` | user\_id, story\_id, count (1–50) | One row per user per story |
| `responses` | story\_id, author\_id, parent\_id?, paragraph\_id?, body | Threaded, optional paragraph anchor |
| `highlights` | user\_id, story\_id, paragraph\_id, start, end, note?, is\_public | Embers; public ones feed "most highlighted" |
| `bookmarks` / `reading_lists` | user\_id, story\_id, list\_id | Saved stories |
| `read_events` | story\_id, viewer\_hash, read\_ratio, seconds, referrer, created\_at | Anonymous-safe; powers stats and trending |
| `notifications` | user\_id, type, actor\_ids, target, read\_at | Grouped by type + target |
| `prompts` | week, text\_es, text\_en | Weekly spark |
| `reports` / `blocks` | reporter, target, reason, status | Moderation |

Trending score: sparks, reads with read ratio > 0.5, highlights and responses over the last 72 hours, with time decay. Recompute every 15 minutes.

## UX, design, accessibility, performance and SEO

### Interaction quality

- Optimistic UI for sparks, follows, bookmarks and responses; roll back gracefully on error.
- Micro-interactions: spark burst, flame flicker on publish, smooth page transitions (View Transitions API). Respect `prefers-reduced-motion`.
- Skeleton loaders, never spinners over content.
- Keyboard shortcuts: `/` search, `n` new story, `s` spark, `b` bookmark, `?` shows the list.
- Command palette (`⌘K` / `Ctrl+K`) for navigation and actions.
- Mobile-first: thumb-reachable actions, bottom bar on phones, sticky spark/share bar while reading.
- Empty states that teach: an empty feed suggests topics, an empty profile suggests a first story.

### Design system

- Design tokens as CSS variables for color, spacing, radius, type scale; light, dark and sepia themes.
- Reading measure 65–75 characters, body 20–21px, line height \~1.6.
- Document components in a `/design` route inside the app (living style guide).

### Accessibility

- WCAG 2.2 AA: contrast, focus rings, skip links, landmarks, labeled controls.
- Full keyboard use of editor and reader; screen-reader announcements for sparks and notifications.
- Alt text required on image upload, with a gentle prompt.

### Performance targets

- LCP < 2.0 s on 4G mid-range phones, CLS < 0.05, INP < 200 ms on story pages.
- Story pages statically rendered with on-demand revalidation; images via `next/image` with AVIF/WebP.
- JavaScript on the story page kept minimal; editor code loaded only on write routes.

### SEO

- Clean URLs: `fogata.org/@username/story-slug`, `/es/` and `/en/` locale prefixes for UI.
- `Article` structured data, canonical URLs, `hreflang`, XML sitemaps per language, RSS.
- Server-rendered meta and OG tags on every public page.

## Trust, safety and privacy

- **Moderation**: report stories, responses and profiles; admin queue with actions (hide, warn, suspend); block and mute users; keyword filters for responses.
- **Anti-spam**: rate limits on publishing, responses and sparks; new-account limits that relax with good behavior; Cloudflare Turnstile on sign-up.
- **Sanitize everything**: Tiptap JSON rendered server-side with an allowlist; embeds only from approved domains.
- **Privacy**: no third-party ad trackers; read events store a salted hash, not identities; data export and account deletion in settings (GDPR/LFPDPPP-friendly).
- **Legal pages** in ES and EN: terms, privacy, content policy, copyright/takedown process.
- **Security**: RLS tests for every table, secrets only in environment variables, dependency audit in CI.

## Build phases and working rules

### Phases

Build in this order. Each phase ends with a working, deployable app, passing tests and a short demo note in `docs/CHANGELOG.md`.

1. **Phase 0, Foundation**: repo setup, Next.js + TypeScript strict, Tailwind + shadcn/ui, design tokens and themes, next-intl ES/EN, Supabase project + Drizzle migrations, auth (magic link + Google), CI (lint, typecheck, tests), Vercel preview deploys, seed script with 20 realistic bilingual stories.
2. **Phase 1, Write and read**: editor with slash commands and autosave, publish flow, story page with typography and reader controls, profiles, topics, basic home feed.
3. **Phase 2, Social**: follows, sparks, threaded and paragraph responses, bookmarks and reading lists, notifications (realtime + email), circles.
4. **Phase 3, Discovery**: onboarding, personalized and trending feeds, new-voices boost, search, topic pages.
5. **Phase 4, Sharing and growth**: dynamic OG images, quote cards, highlight deep links, share sheet, embeds, RSS, weekly spark, digests, writer stats dashboard, milestones.
6. **Phase 5, Polish and scale**: PWA and offline saved stories, listen mode, command palette, year-in-review, moderation console, performance and accessibility audits, import tools. Leave hooks (not features) for future memberships or tips.

### Working rules for Claude Code

- Before each phase, write a short plan (files, tables, risks) in `docs/plans/phase-N.md`, then build.
- Keep a `CLAUDE.md` at the repo root with commands, conventions and decisions; update it as you go.
- Ask me before: adding a paid service, changing the stack, or deleting data or migrations.
- Commit in small, descriptive steps. Never commit secrets; use `.env.example`.
- Every feature ships with: types, Zod validation, RLS policy, at least one test, ES and EN strings.
- Run lint, typecheck and tests before declaring a step done. Fix failures; don't skip them.
- When a choice is a judgment call, pick the option that best serves readers and note why in `CLAUDE.md`.
- Use realistic seed content in both languages so every screen can be reviewed without real users.
