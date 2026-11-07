# Phase 2 leftovers

The social features Phase 2 left for later, approved by the owner ("ok to all"). Built in this
order, one commit each.

## 1. Undo sparks

- `setSparks({ count: 0 })` already deletes the row. The spark button gets a small "Take back"
  control once the reader has sparked; tapping it removes all their sparks on that story.
- New `public.unnotify(recipient, kind, actor, story, response, circle)`: removes the actor from the
  matching **unread** group (deleting it when nobody is left). A delete trigger on `sparks` and
  `response_sparks` calls it, so taking sparks back also takes back the unread notification.

## 2. Edit responses

- `responses.edited_at` (set by a trigger when `body` changes; users can't set it). Grants already
  allow updating `body` on own rows.
- `editResponse(id, body)` reuses `responseSchema`'s body rules. The response menu gets "Edit";
  edited responses say "edited".
- Mentions added in an edit notify the newly mentioned people (an `after update of body` trigger
  compares old and new handles); no one is notified twice.

## 3. Decline note

- `circle_submissions.decline_note` (≤ 500 characters, only when declined; DB check). Editors can
  update it (column grant). Declining opens a small form with an optional note.
- The writer's "declined" notification (page and weekly email) shows the note.

## 4. Delete or transfer circles

- Delete: owner only (RLS delete policy + grant), confirmed by typing the circle's name. Members,
  submissions, follows, join requests and notifications cascade; stories stay with their writers.
  The header picture is cleaned by the daily cron (already in `orphaned_uploads()`).
- Transfer: `public.transfer_circle(circle, new_owner)` (security definer): only the owner, only to
  a current member; the old owner becomes an editor, the new one is told (`circle_owner`
  notification).

## 5. Reading lists

- `reading_lists(id, user_id, name)` (own-only RLS, ≤ 50 per reader by trigger, names 1–60).
- `bookmarks.list_id` (null = the default "Saved" list). One row per reader, story and list.
- The bookmark button saves to Saved in one tap (as now) and opens a small menu to tick other
  lists, create a list or remove the story. `/me/saved` shows Saved plus a chip per list; a list
  can be renamed or deleted (its stories stay in any other list).
- `story_heat()` counts one save per reader per story. Lists are in the data download.

## 6. Block and mute

- `user_blocks(blocker_id, blocked_id, kind mute|block)`, own-only RLS, not yourself.
- Both: the person's activity never notifies you (`notify()` checks first), their stories leave
  your home feeds, and their responses on story pages are collapsed behind "Show".
- Block also: removes follows both ways (trigger), and they can't follow you, respond to your
  stories, reply to your responses or spark them (insert policies). They aren't told.
- Profile pages get a menu with Mute / Block (with an explanation); Settings → Account lists
  muted and blocked people with Unmute / Unblock.

## Risks

- Cached lists (topics, circles, search) are shared by everyone, so muting only filters the
  per-reader home feeds and responses; the plan says so in the UI copy.
- `notify()`'s `ON CONFLICT` target must stay in step with `notifications_unread_group_key` and
  `notify_badge()`; the new early return doesn't touch it, and `unnotify()` matches the same keys.
- Changing the bookmarks unique key needs the old index dropped and the insert policy updated in
  the same migration.
