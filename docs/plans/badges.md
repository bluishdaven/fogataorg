# Badges (draft, not built)

Goal: quiet recognition next to writers' names, without a paid tier. Two kinds: a writing tier that
grows with published stories, and a donor badge the owner grants for two months.

Status: proposal awaiting the owner's choice of names and the open decisions below.

## Writing tiers

The names follow the stages of building a fire. They avoid words Fogata already uses (Chispas /
Sparks, Brasa / Ember, Leña guardada / Saved, Fogata / Circle, Lo que arde / Burning now).

| Tier | Published stories | English | Español | Meaning |
| --- | --- | --- | --- | --- |
| 1 | 1 | Kindling | Yesca | The first story lights it |
| 2 | 5 | Flame | Llama | A steady flame |
| 3 | 15 | Hearth | Hogar | A place people gather |
| 4 | 30 | Bonfire | Hoguera | A fire seen from far away |
| 5 | 50 | Beacon | Faro | A light that guides others |

- **What counts**: published, public stories whose date has arrived. Drafts, scheduled, unlisted
  and deleted stories don't count. The tier follows the live count, so unpublishing can lower it.
- **Only the highest tier shows.** No badge before the first story.
- **Icons**: the Fogata flame evolves. Outline (Yesca), solid (Llama), with its inner glow (Hogar),
  doubled (Hoguera), ringed (Faro). All in ember; no new colors.
- No perks. Badges never unlock features ("No Pro tier anywhere" still holds).

## Donor badge

| English | Español | Alternatives |
| --- | --- | --- |
| Firekeeper | Mecenas | Patron / Mecenas · Keeps the fire / Aviva el fuego |

"Mecenas" is the same for everyone, so Spanish needs no gendered forms.

- **How someone gets it**: they donate on Buy Me a Coffee, then email a screenshot of the receipt,
  from the address of their Fogata account, to a donations inbox. The owner grants it in an admin
  page.
- **Duration**: two months from the grant. A new donation while the badge is active extends it from
  the current end date, so donating early never loses days.
- **Look**: a gold (amber) circle with a cream flame. Shown next to the writing tier, never instead.
- **Consent**: the badge reveals that someone donated, so it's granted only when they ask (the email
  is the request) and removed whenever they ask.
- The donor sees "Firekeeper until 5 Jan 2027" in **Settings → Profile**; other people only see the
  badge, never dates or amounts.

## Where badges appear

Next to the name everywhere a person is named: story lists (home, topics, circles, search, saved),
the story byline, the "written by" card, responses, people results in search, circle member lists,
the account menu label, and the profile page. Compact screens show icons only (with an accessible
label and a tooltip such as "Hoguera · 30+ historias publicadas"); the profile page shows labeled
chips.

## Admin page (owner only)

`/admin/donors`, visible only to accounts with `role: "admin"` in Supabase `app_metadata` (which only
the Supabase dashboard or service key can set, so no one can grant themselves admin):

- Grant: look up by `@username` or account email, add a private note (e.g. "BMC 2026-11-05,
  screenshot in Gmail"), grant. Shows the new end date.
- List: active Firekeepers with end dates, the ones ending in the next two weeks, and past grants.
- Revoke: ends the badge immediately.

## Data model

- Tier: computed in author queries from a count of published stories; no new column. (If listings
  get heavy, add a trigger-maintained `profiles.published_count` later.)
- `profiles.donor_until timestamptz`: public, read by every author query; the badge shows while it's
  in the future. Users can't update it (no column grant).
- `donor_grants` (id, user_id, granted_by, note, starts_at, ends_at, revoked_at): private audit log;
  RLS lets only admins read it.
- `public.grant_donor_badge(target uuid, note text)` and `public.revoke_donor_badge(target uuid)`:
  security-definer functions that check `is_admin()`, write the log and set `donor_until`.
- Expiry needs no cron: the badge disappears once `donor_until` passes. Cached listings can show it
  for up to about an hour after it ends.

## Open decisions for the owner

1. Names: keep Kindling/Yesca … Beacon/Faro and Firekeeper/Mecenas, or pick alternatives.
2. Thresholds: 1 / 5 / 15 / 30 / 50 published stories.
3. Renewal: extend from the current end date (proposed) or restart two months from the new grant.
4. Donations inbox: e.g. `donaciones@fogata.org`, forwarded to your Gmail with Spaceship's free email
   forwarding. Sending already works through Resend; receiving needs this forwarding.
5. Optional later: an email to donors a week before the badge ends (uses the existing email setup).

## Build outline (once approved)

1. Migration: `donor_until`, `donor_grants`, admin check, grant/revoke functions, RLS and grants.
2. Domain: tier thresholds and names, donor status, Zod inputs; unit tests.
3. Author queries carry `publishedCount` and `donorUntil`; a `<UserBadges>` component next to every
   name; profile chips; settings line for donors.
4. Admin page with grant, list and revoke; EN + ES strings.
5. Tests: tiers at each threshold, grants by admins only, expiry, renewal stacking, badges visible on
   each screen, axe in all three themes. Then docs, migration and deploy.
