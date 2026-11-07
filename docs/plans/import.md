# Import from Medium, Substack and WordPress

Writers bring their archive in one go: upload the export file, pick posts, get drafts.

## Formats

- **Medium**: Settings → Security and apps → Download your information. A zip; each post is
  `posts/*.html` (`h1.p-name`, `section[data-field=subtitle]`, `section[data-field=body]`,
  `a.p-canonical`, `time.dt-published`; drafts start with `draft_`).
- **Substack**: Settings → Exports. A zip with `posts.csv` (id, date, published, title, subtitle)
  and `posts/<id>.html` (body only).
- **WordPress**: Tools → Export → Posts. A WXR `.xml`; `<item>`s with `wp:post_type=post`,
  `content:encoded` (classic posts may have no `<p>`: blank lines are paragraphs).
- A single `.html` file works too (one post).

## How

1. **In the browser** (`/write/import`): read the file (a small zip reader on
   `DecompressionStream`, no new dependency), parse with `DOMParser`, convert each post's HTML to
   the story document the sanitizer accepts (`htmlToDoc`: paragraphs, headings, quotes, pull
   quotes, lists, code, rules, figures; embeds become a link; scripts and forms are dropped), give
   every block an id, guess the language from common words. The writer sees the list (drafts
   unticked) and chooses whether search engines should keep pointing to the originals (canonical
   links, when the export has them).
2. **On the server** (`importStory`, one post per call so progress shows): copy each picture into
   the writer's `story-images` folder (fetched with an SSRF guard: http(s) only, public addresses
   only, 3 redirects, 10 s, 15 MB, re-encoded by `sharp` to WebP ≤ 2400 px without metadata, at most
   25 per post). Pictures that can't be copied become a link to the original. Then
   `sanitizeStoryDoc()` and insert a draft (`draft-<id>` slug). Nothing is published or announced:
   the writer reviews and publishes each one.

Limits: 200 posts per file, `importStory` rate limit (300 a day, 30 on an account's first day).

## Tests

Unit: zip reader (built with zlib in the test), CSV, HTML conversion per platform, language guess,
address checks. DB: none new. E2E: a WordPress file with two posts becomes two drafts with their
text; a picture on a private address becomes a link.
