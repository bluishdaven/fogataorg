# Badges

Goal: quiet recognition next to writers' names, without a paid tier. Two kinds: a writing tier that
grows with published stories (1 to 1,000), and a permanent donor badge the owner grants.

Status: built 2026-11-05 as described below (ten tiers up to 1,000 stories; permanent donor badge).
Still open: the donations inbox (decision 3).

## Writing tiers

Ten tiers. The names climb from fire on the ground to light in the sky, ending with the fire that
never goes out. They avoid words Fogata already uses (Chispas / Sparks, Brasa / Ember, Leña guardada /
Saved, Fogata / Circle, Lo que arde / Burning now).

| Tier | Published stories | English | Español | Meaning |
| --- | --- | --- | --- | --- |
| 1 | 1 | Kindling | Yesca | The first story lights it |
| 2 | 5 | Candle | Vela | A small, steady light |
| 3 | 12 | Flame | Llama | A real fire now |
| 4 | 25 | Torch | Antorcha | A light you can carry to others |
| 5 | 50 | Hearth | Hogar | A place people gather |
| 6 | 100 | Bonfire | Hoguera | A fire seen from far away |
| 7 | 200 | Beacon | Faro | A light that guides others |
| 8 | 350 | Star | Estrella | Fire in the sky |
| 9 | 600 | Sun | Sol | A light everything turns toward |
| 10 | 1,000 | Phoenix | Fénix | The fire that never goes out |

- **Harder as it goes**: each step asks for roughly double the last. Writing every week, Candle comes
  in about a month, Hearth in a year, Bonfire in two; Phoenix takes most of a lifetime at that pace,
  which is the point.
- **What counts**: published, public stories whose date has arrived. Drafts, scheduled, unlisted and
  deleted stories don't count. The tier follows the live count, so unpublishing can lower it.
- **Only the highest tier shows.** No badge before the first story.
- **Icons**: tiers 1–7 are the Fogata flame in ember, evolving (outline, on a candle, solid, on a
  torch, with its inner glow, doubled, ringed). Tiers 8–10 switch to gold: a star, a sun and a
  phoenix, each carrying a small flame. Final artwork is drawn during the build.
- No perks. Badges never unlock features ("No Pro tier anywhere" still holds).

## Donor badge

| English | Español | Alternatives |
| --- | --- | --- |
| Firekeeper | Mecenas | Patron / Mecenas · Keeps the fire / Aviva el fuego |

"Mecenas" is the same for everyone, so Spanish needs no gendered forms.

- **How someone gets it**: they donate on Buy Me a Coffee, then email a screenshot of the receipt,
  from the address of their Fogata account, to a donations inbox. The owner grants it in an admin
  page.
- **Permanent**: once granted it stays. Later donations change nothing (they're noted in the log).
  The owner can remove it, e.g. when someone asks or for a refunded donation.
- **Look**: a gold circle with a cream flame, shown next to the writing tier, never instead.
- **Consent**: the badge reveals that someone donated, so it's granted only when they ask (the email
  is the request) and removed whenever they ask.
- Other people only see the badge, never dates or amounts.

## Where badges appear

Next to the name everywhere a person is named: story lists (home, topics, circles, search, saved),
the story byline, the "written by" card, responses, people results in search, circle member lists,
the account menu label, and the profile page. Compact screens show icons only (with an accessible
label and a tooltip such as "Hoguera · 100+ historias publicadas"); the profile page shows labeled
chips.

## Admin page (owner only)

`/admin/donors`, visible only to accounts with `role: "admin"` in Supabase `app_metadata` (which only
the Supabase dashboard or service key can set, so no one can grant themselves admin):

- Grant: look up by `@username` or account email, add a private note (e.g. "BMC 2026-11-05,
  screenshot in Gmail"), grant.
- List: every Firekeeper with the date granted and notes, newest first.
- Remove: takes the badge away (kept in the log).

## Data model

- Tier: computed in author queries from a count of published stories; no new column. (If listings
  get heavy, add a trigger-maintained `profiles.published_count` later.)
- `profiles.donor_since timestamptz`: public, read by every author query; the badge shows when set.
  Users can't update it (no column grant).
- `donor_grants` (id, user_id, granted_by, note, granted_at, removed_at): private log; RLS lets only
  admins read it.
- `public.grant_donor_badge(target uuid, note text)` and `public.remove_donor_badge(target uuid)`:
  security-definer functions that check `is_admin()`, write the log and set or clear `donor_since`.
- No expiry, so no cron.

## Open decisions for the owner

1. Names: keep Kindling/Yesca … Phoenix/Fénix and Firekeeper/Mecenas, or pick alternatives.
2. Thresholds: 1 / 5 / 12 / 25 / 50 / 100 / 200 / 350 / 600 / 1,000 published stories.
3. Donations inbox: e.g. `donaciones@fogata.org`, forwarded to your Gmail with Spaceship's free email
   forwarding. Sending already works through Resend; receiving needs this forwarding.

## Build outline (once approved)

1. Migration: `donor_since`, `donor_grants`, admin check, grant/remove functions, RLS and grants.
2. Domain: tier thresholds and names, Zod inputs; unit tests at every threshold.
3. Author queries carry `publishedCount` and `donorSince`; a `<UserBadges>` component next to every
   name; labeled chips on profiles; tier artwork for all ten tiers.
4. Admin page with grant, list and remove; EN + ES strings.
5. Tests: tiers at each threshold, grants by admins only, removal, badges visible on each screen,
   axe in all three themes. Then docs, migration and deploy.
