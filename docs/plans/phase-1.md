# Phase 1 — Write and read

Goal: a signed-in writer can start a story, write it in a calm editor that saves itself, add photos
(their own or from Unsplash), publish it now or later with a cover and topics, and find their drafts
again. Readers get reader controls and a progress bar. Profiles become editable and topics get pages.

## Order (writing path first)

1. Story write actions + server-side content validation.
2. Image uploads to Supabase Storage (own folder per writer, compressed in the browser).
3. Editor: title, subtitle, body; bubble menu on selection; `/` menu; Markdown shortcuts; images
   with alt text and captions; autosave.
4. Publish dialog: cover (upload or Unsplash), alt text, topics (≤5), language, SEO title and
   description, canonical URL, publish now / schedule / unlisted.
5. "Your stories" (drafts, published, scheduled) and a Write button in the header.
6. Story page renders images, captions, credits, callouts, pull quotes and the cover.
7. Reader controls (size, serif/sans, width; theme already exists) and a reading progress bar.
8. Profile settings (name, username, bio, links) and topic pages.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Scheduling | `status = 'published'` with a future `published_at`; "scheduled" is derived | RLS already hides stories until `published_at <= now()`, so they go live on time with no cron job. The `scheduled` enum value stays unused. |
| Editing a published story | Autosave goes to `pending_changes` (jsonb); "Publish changes" applies it | Half-finished edits never show up on a live story. Drafts autosave straight into the story. |
| Autosave conflicts | `revision` counter; saves must match it | Two tabs (or a stale offline copy) can't silently overwrite each other. |
| Offline | Every change is also kept in `localStorage`; saving retries on reconnect | Matches the spec's "works offline and syncs on reconnect" without a sync engine. |
| Slugs | Drafts get `draft-<id>`; first publish sets the slug from the title; later title edits keep it | Shared links never break. |
| Block IDs | Tiptap UniqueID on every block, rendered as `data-block` | Phase 2 paragraph responses and Phase 4 highlight deep links need stable anchors; adding them later would mean rewriting stored content. |
| Content safety | Server validates stored JSON against an allowlist (node types, attrs, image hosts, link protocols, size) before saving; the renderer has its own allowlist | Never trust the client's document. |
| Image hosting | Supabase Storage bucket `story-images`, public read, writes only into `<user id>/`; images compressed to ≤2400px WebP in the browser; served unoptimized for now | Supabase image transformations are a paid feature; compressing on upload keeps pages light. Optimization is a Phase 5 performance item. |
| Embeds, version history, series, draft sharing, import, table of contents | Not in this phase | Spec places them in later phases; noted in CLAUDE.md. |

## Tables and storage

- `stories`: add `pending_changes jsonb`, `revision integer`, `seo_title`, `seo_description`;
  allow an empty title while a story is a draft.
- `storage.buckets`: `story-images` (10 MB, JPEG/PNG/WebP/GIF/AVIF), policies on `storage.objects`.

## Risks

- Tiptap is client-only and must not render during SSR (`immediatelyRender: false`); editor code
  should load only on write routes.
- Caches: publishing must `updateTag` the story, profile and listing tags; a not-found story must not
  be cached for hours (it may be scheduled), so misses get a short cache life.
- Slash menu positioning and focus handling must work with a keyboard and screen readers.
