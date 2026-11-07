# UI audit

Date: 2026-11-05. Scope: the things automated axe scans can't see. Keyboard use, screen-reader
semantics, contrast of interaction states, motion, and real-world performance (Lighthouse and Core
Web Vitals on a production build).

Pages: home, a story, a profile with the badge panel, circles list, a circle page and its manage
page, the editor, settings (profile, email) and notifications. Each one was checked in light, dark
and sepia, at 390px (phone) and 1280px (desktop).

**Result**: the basics were already sound: a skip link, one h1 per page, landmarks, named icon
buttons, focus trapped in every dialog and menu, a global reduced-motion rule, and Lighthouse
accessibility at 100. The real problems were the ones axe can't see. **Keyboard focus was invisible
on every story list and faint everywhere else.** Three dialogs dropped focus when they closed. The
story page jumped when it streamed in, on phones. Those and eight smaller issues are fixed on this
branch, with tests. Section 2 lists what's left, ranked by impact, with the decisions that belong
to the owner.

## 1. Fixed on this branch

Ranked by impact, in small commits.

| # | Finding | Where | Why it matters | Fix | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | **No visible focus on story cards.** The stretched title link set `focus-visible:outline-none` and the card drew nothing in its place. | Every story list: home, topics, profiles, circles, search, saved | Keyboard users couldn't see where they were on the site's main screens (WCAG 2.4.7). | The card draws the outline (`has-[a:focus-visible]:outline-*`) and turns the title ember, like hover. | `keyboard.spec.ts` (3 themes) |
| 2 | **Faint focus rings.** Buttons and inputs replaced the global outline with a 3px ring at 50% alpha: 1.83:1 against the page in light, 2.63:1 in dark, 2.05:1 in sepia. Box-shadow rings also vanish in Windows forced-colors mode. | `Button`, `Input`, and a dozen hand-rolled controls (search, bio, username and slug fields, circle description, response, alt text, caption, donor and moderation forms, badge chips, circle privacy cards) | Non-text contrast needs 3:1 (WCAG 1.4.11). The global outline is 3.3:1 (light), 7.5:1 (dark) and 4.4:1 (sepia). | All of them use the global 2px solid `--ring` outline with a 2px offset (`focus-within`/`has-focus-visible` for wrappers). | `keyboard.spec.ts` |
| 3 | **Focus lost when dialogs close.** Radix only returns focus to a `<DialogTrigger>`. Dialogs opened from code had none, so focus fell to `<body>` and Tab restarted at the top of the page. | Badge guide, publish dialog, Unsplash picker from the editor's photo menu | Keyboard and screen-reader users lose their place every time (WCAG 2.4.3). | `DialogContent` remembers the opener, or for a menu item the menu's button, and restores focus. | `dialog.test.tsx` (unit), `keyboard.spec.ts`, `writing.spec.ts` |
| 4 | **Story page layout shift on phones: CLS 0.24** (Lighthouse mobile, the "poor" threshold is 0.25). The Suspense skeleton was shorter than the screen, so the footer showed and then jumped. | `/@handle/slug` | CLS is a Core Web Vital. Readers lose their place when the page jumps. | The skeleton is at least one screen tall. CLS is now **0.001**, and the story page's Lighthouse performance score went from 68 to 83. | Lighthouse (no stable e2e signal) |
| 5 | **Supabase client in every page's JS.** The bell imported it at module level, so about 66 KB (gzipped) loaded on every page, even for signed-out readers. | Header (`NotificationBell`) | That's a fifth of the JS, parsed before the page is interactive on slow phones. | The bell imports the client inside its effect, after hydration. Home 317 → 251 KB, story 361 → 281 KB; unused JS 115 → 50 KB. | `social.spec.ts` (live bell) |
| 5b | **The bell never updated live.** It subscribed to Realtime before supabase-js passed the session token along, so it joined as `anon`. Realtime refused the subscription ("invalid column for filter user_id"), and the count changed only on focus or navigation. Found by the new live-bell test. | Header bell | CLAUDE.md promises live notifications; readers saw stale counts. | The bell awaits `realtime.setAuth()` before subscribing. | `social.spec.ts` (live bell) |
| 6 | **Focus hidden under the sticky header.** Shift+Tab scrolls the focused card to the top edge, under the 56–64px header (5 cards on home, 12 on circles). | All long pages | WCAG 2.4.11 (focus not obscured). | `scroll-padding-top: 5rem` on `<html>`. It also fixes anchor jumps. | `keyboard.spec.ts` |
| 7 | **Hovered primary buttons failed contrast.** `hover:bg-primary/80` faded toward the page: white text fell to 3.81:1 (light) and 4.26:1 (sepia). | Every default `Button` | Text must stay at 4.5:1 in every state, and axe only checks resting states. | Hover mixes 15% foreground into the primary color, which *raises* contrast in all themes: 6.3, 8.0 and 6.8:1. | `theme-a11y.spec.ts` (3 themes) |
| 8 | **Form errors not tied to fields.** Fields had `aria-invalid` and the messages sat in a summary list, but nothing linked the two. | Settings → Profile, circle form | A screen reader on the field heard "invalid" with no reason (WCAG 3.3.1). | Each message has an id, and the field's `aria-describedby` points at it, next to the existing hint. | `profile-topics-reader.spec.ts` |
| 9 | **Editor had no heading.** Its phone back link was an icon whose text was `display:none`, so it had no name, and it was a 16×16px target. | `/write/[id]` | Heading navigation found nothing, and the link read as "link". | A visually hidden h1 ("Write"). The text is visually hidden (`sr-only sm:not-sr-only`), and the target is 44px. | `theme-a11y.spec.ts` (new: editor and account pages at phone width, 3 themes) |
| 10 | **Focus outline removed inside the editor.** `.editor-body :focus-visible { outline: none }` matched every descendant. | Figure buttons, alt and caption fields, photo-credit links | Invisible focus while editing images. | Only the writing surface drops its outline (the caret shows focus there). | `writing.spec.ts` |
| 11 | **Low-contrast editor hints.** The empty-paragraph hint was `muted-foreground` at 80% opacity (3.74:1). The title placeholder at 70% was 2.97:1 in sepia (large text needs 3:1). | Editor | Placeholder text is text (WCAG 1.4.3). | The hint drops the extra opacity (5.77:1). The title placeholder goes to 80% (≥ 3.6:1). | — (CSS only) |
| 12 | **Toast region announced in English.** Sonner names its live region "Notifications alt+T", in Spanish too, which also clashes with the bell. | Pages with toasts | A Spanish screen reader heard an English landmark. | `containerAriaLabel` is "Alerts" / "Avisos". | `i18n.spec.ts` |
| 13 | **Badge chips read their name twice** ("Kindling: Kindling: first published story"). | Profile badge chips | Noise for screen-reader users. | The visible word is `aria-hidden`; the name still starts with it (WCAG 2.5.3). | `badges.test.tsx` |
| 14 | **Smooth scroll ignored reduced motion.** `scrollIntoView({ behavior: "smooth" })` isn't covered by the CSS rule. | Jump to a paragraph's responses | Vestibular comfort (WCAG 2.3.3). | `scrollBehavior()` in `src/lib/utils.ts` returns `auto` under `prefers-reduced-motion`. | `scroll-behavior.test.ts` |

## 2. Open findings (ranked)

### 2.1 Responding to a paragraph needs a mouse or touch (medium-high)

- **What**: the "Respond" button for a paragraph appears only after selecting text, and it floats
  at the end of the DOM. Keyboard users can't select text in a read-only page, unless they turn on
  caret browsing, so they can only leave a general response.
- **Where**: `src/components/social/paragraph-anchors.tsx`.
- **Why**: a feature that only works with a pointer fails WCAG 2.1.1 (Keyboard).
- **Fix**: give keyboard users their own path. Either:
  - a "Respond to a paragraph…" control in the composer that lists paragraph openings, or
  - a focusable "Respond" button that shows on `:focus-within` of each paragraph, after it in the
    DOM.

  The first is less visual noise for readers.

### 2.2 Input borders are 1.4:1 against the page (medium; palette change, needs a decision)

- **What**: `--input` is 1.40:1 against the page in light, 1.54:1 in dark and 1.45:1 in sepia.
  Fields are mostly found by their labels.
- **Where**: every text field, textarea and select.
- **Why**: WCAG 1.4.11 asks 3:1 for the boundary when it's what identifies the control, as in the
  search box or a field without a visible label (link rows in Settings → Profile). Low-vision
  readers can't see where to click.
- **Fix** (changes the palette, so not done): darken `--input` to about **#968d7f** (light, 3.03:1),
  **#5e636e** (dark, 3.24:1) and **#94866e** (sepia, 3.03:1). Those are the current colors moved
  toward the foreground until they reach 3:1 against both background and card. Only form borders
  would look heavier; `--border` (dividers) can stay as is.

### 2.3 Mobile LCP: fonts are a third of the critical bytes (medium; font change, needs a decision)

- **What**: Lighthouse's simulated slow-4G phone puts LCP at **4.2–4.7 s** after the fixes (it was
  4.8–5.4 s). The LCP element is text, and render delay is almost all of it. Observed LCP on
  localhost is 0.5–0.6 s, so this is about bytes on a slow network, not server time. Every page
  preloads three fonts: Inter 48 KB, Source Serif 4 roman 127 KB and italic 120 KB. The serif files
  are large partly because they carry the optical-size axis (`axes: ["opsz"]`) on top of weight.
- **Why**: LCP under 2.5 s is the "good" Core Web Vitals threshold, and many readers will be on
  phones with patchy data.
- **Fix options** (fonts are off-limits without asking):
  1. **Don't preload the italic.** Split it into its own `next/font` instance with
     `preload: false`. Italic only appears in pull quotes and emphasis, and `display: swap` covers
     the first paint. This saves 120 KB from the critical path and leaves the type unchanged.
  2. **Drop the `opsz` axis**, or keep it only for headings. That makes both serif files smaller; measure before deciding.
  3. **Statically render the most-read stories** (`generateStaticParams`; already a known gap).
     The story HTML would then arrive in the first response instead of streaming after the shell.

### 2.4 Prefetching `/@handle` links returns 404 (medium-low)

- **What**: author links (`/@lucia_ortega`) trigger a segment prefetch for
  `/$d$locale/__PAGE__`. The client router matches `/@handle` against `/[locale]` with
  `locale = "@handle"`, but the proxy rewrites the request to `/en/u/handle`, which has no such
  segment, so the server answers 404. Story links (`/@handle/slug`) don't hit this.
- **Where**: story pages and circle pages, wherever a profile link is in view.
- **Why**: a console error on every story view costs best-practices points (96 instead of 100).
  The prefetch is wasted, and profile navigations aren't instant.
- **Fix options**:
  1. `prefetch={false}` on `profilePath()` links. That's simple and loses only the prefetch.
  2. Move the `/@handle` rewrite into `next.config` `rewrites()` (with `has` on the locale cookie),
     so the client router knows the real route.
  3. Report it upstream: the segment cache should follow `x-nextjs-rewritten-path`.

  The first is enough until profiles need instant navigation.

### 2.5 zod ships to the browser on every page (medium-low)

- **What**: the `zod` chunk (about 30 KB gzipped, ~24 KB of it unused) loads on public pages. Client
  components import small helpers from domain modules that build schemas at the top level.
- **Where**:
  - `unsplashImageUrl` from `domain/unsplash`
  - `initials` from `domain/avatars`
  - badge helpers from `domain/badges`
  - `MAX_SPARKS` from `domain/social`
- **Why**: about 10% of first-load JS for code the browser never runs.
- **Fix**: split each module into a zod-free part (constants and pure helpers, imported by client
  components) and a schema part (used by server actions). Re-export from the current path so server
  imports don't change. Alternatively, `zod/mini` cuts the cost to a few KB if schemas are needed
  client-side.

### 2.6 Subtitle placeholder is 2.5:1 (low-medium; design decision)

- **What**: the editor subtitle placeholder is `muted-foreground` at 60%: 2.54:1 (light), 2.48:1
  (sepia), 3.63:1 (dark). It's 20px regular text, so it needs 4.5:1. Typed subtitles use full
  `muted-foreground`, so raising the placeholder to full would make it look like real text.
- **Fix**: pick one of the following:
  - typed subtitles in `foreground` at about 80% with the placeholder at full `muted-foreground`
  - a visible "Subtitle (optional)" label instead of placeholder-only

### 2.7 Autosave status talks a lot (low-medium)

- **What**: the save status is `role="status" aria-live="polite"` and flips between "Saving…" and
  "Saved" every few seconds while someone types.
- **Why**: screen-reader users hear a stream of interruptions while writing.
- **Fix**: keep the visible text as is, but announce only what needs attention (a failed save, a
  conflict, "Saved" after a long idle), through a separate `sr-only` live region.

### 2.8 Smaller items (low)

- **Touch targets on phones.** `size="sm"` buttons, topic chips, the language switcher and the
  Follow button are 40px tall. That's inside the project rule (`min-h-10 … sm:min-h-8`) and well
  over WCAG 2.2 AA (24px), but under the 44px of WCAG AAA and Apple's guidelines. The figure buttons
  in the editor (32px) and the accent swatches on the manage page (36px) are the smallest. Consider
  `size-11` for the editor figure buttons, which sit right on top of the image.
- **Photos in dark mode** show at full brightness on #0a0d14. Dimming them slightly, back to full on
  hover or focus, is common for reading apps (`dark:brightness-90`). It's a design call, so not done.
- **Browser theme color** (`viewport.themeColor`) follows the OS, not the theme the reader picked.
  A reader in sepia on a dark-mode phone gets a night-blue address bar. next-themes could update
  the meta tag on change.
- **Writing surfaces show focus only with the caret** (title, subtitle, body). That's normal for
  editors (Medium and Substack do the same), so it's left as is on purpose.
- **Dialogs open with focus on the close button** (badge guide, submit-story dialog). It's the Radix
  default and acceptable, but focusing the first real control, such as the first story in the
  submit dialog, saves a Tab.
- **Lighthouse SEO flags a missing meta description** on stories, profiles and circles. It's there:
  Next streams metadata into `<body>`, which Googlebot reads, and HTML-only bots get it in `<head>`
  (Next docs, "Streaming metadata"). It's only a Lighthouse artifact, and `htmlLimitedBots: /.*/`
  would silence it at some cost to time-to-first-byte.
- **Reading settings button**: the visible label is "Aa" and the accessible name is "Reading
  settings" (WCAG 2.5.3 wants the visible text in the name). "Aa" is a glyph more than a word, so
  this is a nit.
- **"Merch, coming soon"** is a disabled button: skipped by Tab and 2.5:1. That's exempt as
  inactive, but plain text with a "soon" chip would read better.

### 2.9 Test suite notes (not UI, found while running it)

- **`email.spec.ts` "writers get a summary email…" is timing-dependent.** It expects "1 new
  notification", the follow. Whether the writer's first-story Kindling notification is already in
  the summary depends on whether `check_writing_badge()` sees the new story at publish time:
  `published_at` comes from the app clock, the trigger compares it with the transaction's `now()`,
  and they're milliseconds apart. If the trigger misses it, the daily job announces the badge later.
  On this machine it passed twice and failed three times with "2 new notifications". The test
  should accept the badge, or publish before following and assert on the follow line only.
- **`reading.spec.ts` needs a fresh seed.** It looks for seed stories on the home page, which lists
  the 20 newest. After a day of e2e runs the shared local DB had 164 newer test stories, so a build
  made then doesn't list them. `npm run db:reset && npm run db:seed` fixes it locally. A longer-term
  option is giving e2e-created stories an old `published_at`, or filtering them out of the home
  assertion.

## 3. Checked and fine

- **Skip link**: it's the first Tab stop on every page, visible on focus, and the next Tab lands
  inside `<main>`.
- **Headings**: exactly one h1 on every page (the editor now too), and no skipped levels. Story
  cards are h3 under the list's h2. The badge guide is an h2 dialog title with h3 sections.
- **Landmarks**: banner, main, contentinfo, and named navs ("Main", "Footer", "Settings sections").
  The story page has an "About the writer" aside.
- **Names**: every icon-only control has a name (search, theme, language, bell with unread count,
  share, save, spark, write, account with initials). Decorative SVGs are `aria-hidden`.
- **Dialogs and menus**: focus moves in on open, Tab never leaves (25 presses each), Escape
  closes, and focus returns to the opener. Checked on the badge guide, theme, reading settings,
  share, account, photo menu, submit story, Unsplash picker and publish dialog.
- **Live regions**: toasts (Sonner, polite), autosave status, search result counts, spark count
  changes, form saved and error messages (`role="status"` / `role="alert"`).
- **Motion**: with `prefers-reduced-motion: reduce`, no animation is running on any page (checked
  with `document.getAnimations()`). The flame flicker is `motion-safe:` and the global rule covers
  dialogs, menus, the spark burst and toasts.
- **Selection colors**: 14.2:1 (light), 12.5:1 (dark), 9.6:1 (sepia).
- **Disabled states** (50% opacity) are exempt from contrast as inactive controls. They're 3.3:1,
  4.5:1 and 2.7:1, still readable.
- **Lighthouse**: accessibility 100 on all pages, best practices 96–100 (the 4 points are 2.4),
  desktop performance 98–99, total blocking time 0 ms everywhere.

## 4. Lighthouse numbers

Production build (`next build && next start`), Lighthouse 12.8, default mobile emulation (slow 4G,
4× CPU) unless marked desktop. LCP is simulated. On localhost the observed LCP was 0.5–0.6 s on
every page.

| Page | Before: perf / CLS / LCP / JS | After: perf / CLS / LCP / JS |
| --- | --- | --- |
| Home | 82 / 0 / 5.0 s / 317 KB | 85 / 0 / 4.4 s / 251 KB |
| Story | 68 / **0.236** / 5.4 s / 361 KB | 83 / 0.001 / 4.7 s / 281 KB |
| Profile | 81 / 0.013 / 5.1 s / 344 KB | 86 / 0.002 / 4.2 s / 273 KB |
| Circles | 82 / 0 / 5.0 s / — | not re-run |
| Circle | 83 / 0 / 4.8 s / — | not re-run |
| Desktop (all five) | 98–99 / ≤ 0.018 / 0.9–1.0 s | not re-run |

## 5. Re-running this audit

- **Automated, every run**:
  - `keyboard.spec.ts`: focus outlines in 3 themes, header overlap, dialog and menu focus return.
  - `theme-a11y.spec.ts`: axe on public pages, the badge guide, and the editor and account pages at
    phone width; hover contrast.
  - `dialog.test.tsx`.
- **Manual pass**:
  - Tab through each page in each theme and watch for a missing outline.
  - Turn on VoiceOver (Cmd+F5) and use the rotor's headings and landmarks lists.
  - Run Lighthouse against `npm run build && PORT=3100 npm run start`.
- **Focus rule for new UI**: don't put `outline-none` or `ring-*/50` on interactive elements. The
  global `:focus-visible` outline is the focus style. A stretched-link card draws the outline on
  the card (`has-[a:focus-visible]:`). Dialogs opened from code get focus return for free from
  `DialogContent`.
