# Profile extras and share previews

Asked for on 2026-11-06: "now reading/watching/listening", references (books, movies, music,
politics), optional pronouns, a word count next to the story count, and better link previews for
the site, stories and profiles.

## Profile extras

| Piece | Storage | Limits | Shown |
| --- | --- | --- | --- |
| Pronouns | `profiles.pronouns` text | optional, ≤ 40 chars, free text | profile header (`@handle · they/them`), writer card |
| Now | `profiles.now_focus` (`reading` / `watching` / `listening`) + `now_text` | ≤ 120 chars; hidden when empty | profile, under the bio |
| Influences ("Referencias" in ES) | `profiles.influences` jsonb `{ books, movies, music, politics }` | ≤ 5 entries per kind, ≤ 80 chars each | profile, grouped by kind |
| Word count | `stories.word_count`, generated from `content_text` by `public.count_words()` | n/a | profile: `12 stories · 18,450 words` |

- The owner edits them in Settings → Profile; new column grants let only the owner change their own
  row (existing `profiles_update_own` policy). DB checks cap lengths even through the Data API, and
  the profile page re-validates `influences` with Zod before rendering.
- `count_words()` mirrors `countWords()` in `src/lib/domain/content.ts` (letters, digits, inner
  apostrophes and hyphens); a db test compares them. Being a generated column, it can't be faked and
  existing stories are counted when the migration runs.
- Totals cover the same stories the profile lists: published, public, live, not removed.

## Share previews (Open Graph)

Generated with `next/og` (`ImageResponse`) in route handlers under `/api/og/` (outside the proxy's
locale handling), with the site's fonts bundled from `src/assets/fonts/` (OFL) and long CDN caching.
Image URLs carry a version so edits show up in new shares.

- **Site** (`/api/og/site?locale=`): flame, "Fogata", the tagline, fogata.org. Default for every page.
- **Stories**: an Unsplash picture is linked directly (hotlinking is required), sized 1200×630; an
  uploaded picture is re-encoded to JPEG by `/api/og/story/...` (WebP isn't accepted everywhere);
  no picture, or NSFW: a card with the flame, title, writer and fogata.org.
- **Profiles** (`/api/og/profile/[handle]`): photo (or initials), name, @handle, bio, stories and
  words, fogata.org. Photos are WebP, which the image renderer can't draw, so `sharp` converts them.
  Card text follows the person's own language (stories follow the story's language).
