# Phase 2 — Social

Goal: readers can follow writers and topics, spark stories, save them for later, respond (to the
whole story or to one paragraph) and get grouped notifications that never spam.

## Status (2026-11-05)

Done: follows, sparks, saved, responses (threads, paragraph anchors, mentions, pinning, sparks),
in-app notifications with Realtime. Also shipped alongside: list thumbnails and search.
Circles shipped the same day (members, submission queue, follows, notifications, search).
Remaining: email notifications (provider decision pending).

## Order

1. Follows (writers, topics; circles reuse the same table later).
2. Sparks on stories (1–50 per reader), with the burst animation and optimistic UI.
3. Saved stories ("Leña guardada"), private to each reader.
4. Responses: threaded one level deep, optional paragraph anchor, @mentions, sparks on responses,
   author pinning, "author replied" badges.
5. Notifications: grouped in the database, live in the header via Supabase Realtime.
6. Circles (community publications) — after the above, possibly its own pass.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Follow targets | One `follows` table with nullable `followed_user_id` / `followed_topic_id` (circle later) and a check that exactly one is set | Real foreign keys (cascade on delete) instead of an untyped `target_id`. |
| Sparks | One row per reader per story, `count` 1–50; the client batches taps and saves the total | 50 taps shouldn't mean 50 requests. Writers can't spark their own stories. |
| Sparks on responses | A single spark per reader per response | The 50-spark mechanic is for stories; responses just need appreciation. |
| Saved | `bookmarks` per reader, private; schema leaves room for named lists | Spec mentions reading lists; one list covers the need now. |
| Threading | One level (responses and replies) | Keeps conversations readable; matches the spec's "threaded" without deep trees. |
| Paragraph anchors | `responses.block_id` = the Tiptap block id rendered as `data-block` | Stable across edits because ids live in the stored document. |
| Pinning | Security-definer SQL function that checks the caller wrote the story | RLS can't let story authors change only `pinned_at` on someone else's row. |
| Notifications | Created by database triggers, grouped per (recipient, type, story/response) while unread | "12 people sparked your story" for free; no app code path can forget to notify. |
| Realtime | Supabase Realtime `postgres_changes` on `notifications`, RLS-filtered to the recipient | Live badge without polling. |
| Email | Not in this pass | Needs an email provider decision (Resend in the spec has a free tier but needs an account and key); notifications are stored so email digests can batch them later. |

## Tables

`follows`, `sparks`, `response_sparks`, `bookmarks`, `responses`, `notifications`, each with RLS,
grants and tests. Triggers: notify on first spark, response, reply, mention and follow.

## Risks

- Story pages are cached for everyone; per-reader state (your sparks, saved, following) must load in
  a Suspense boundary or client component, never in the cached part.
- Counts (sparks, followers) are computed on read for now; denormalize when trending needs them.
- Realtime needs the `notifications` table added to the `supabase_realtime` publication.
