# Fogata.org

Long-form reading and writing platform; the UI ships in English and Spanish. Product spec: `docs/PRODUCT_SPEC.md`.
Phase plans: `docs/plans/`. What shipped: `docs/CHANGELOG.md`. Setup and deploys: `docs/SETUP.md`.

@AGENTS.md

## Commands

| Task | Command |
| --- | --- |
| First-time local setup (Docker running) | `npm install && npm run setup` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Lint + typecheck + unit tests | `npm run check` |
| RLS tests (needs local Supabase) | `npm run test:db` |
| E2E tests (needs Supabase + seed) | `npm run test:e2e` (reuses a running dev server) |
| New migration from schema change | edit `src/lib/db/schema.ts` → `npm run db:generate -- --name <what>` |
| Hand-written SQL migration | `npm run db:migration -- --name <what>` |
| Apply migrations from scratch | `npm run db:reset` then `npm run db:seed` |
| Supabase Studio / Mailpit | http://127.0.0.1:54323 / http://127.0.0.1:54324 |

Run `npm run check` (and `test:db` / `test:e2e` when touching data or UI flows) before calling a step done.

## Architecture

- **Next.js 16.4, App Router, Cache Components on.** Pages are a static shell; anything reading
  cookies, headers, search params or runtime `params` must sit inside `<Suspense>`. Public data
  reads use `'use cache'` + `cacheTag` in `src/lib/data/*`. Never read request data at the top of a
  layout. Client hooks like `usePathname()` outside Suspense also block prerendering: read
  `window.location` in event handlers instead.
- **Routing.** UI pages live under `src/app/[locale]/` (`/en`, `/es`). Share URLs `/@handle` and
  `/@handle/slug` have no prefix: `src/proxy.ts` rewrites them to `/{locale}/u/...` using the
  `NEXT_LOCALE` cookie, then `Accept-Language`. Link to them with `next/link` and
  `storyPath()` / `profilePath()`, **not** the i18n `Link` (which would add a prefix).
- **i18n.** next-intl v4 with `next/root-params` for the locale. Messages in `messages/{en,es}.json`
  (typed from `en.json`; a test enforces key and ICU-argument parity). Server Actions and Route
  Handlers can't read root params: pass `locale` explicitly to `getTranslations`.
- **Database.** Drizzle schema in `src/lib/db/schema.ts` is the source of truth for tables and RLS
  policies. `drizzle-kit generate` writes SQL to `supabase/migrations/`, which the Supabase CLI
  applies (`db reset` locally, `db push` in the cloud). Triggers, functions and grants go in
  hand-written migrations next to the generated ones.
- **RLS is real.** `db` connects as the owner and bypasses RLS, so app code must use
  `withRls(claims, tx => …)` or `asAnon(tx => …)` from `src/lib/db/rls.ts`. They switch the
  transaction to Supabase's `anon` / `authenticated` role with JWT claims set. Public reads run as
  `anon` so drafts can't leak even if a filter is wrong.
- **Grants narrow what RLS can't.** Users may update only whitelisted profile columns and can never
  hard-delete stories. New tables: revoke all from `anon, authenticated`, then grant what's needed.
- **Auth.** Supabase Auth via `@supabase/ssr`. The proxy refreshes the session on every request.
  `getViewer()` (`src/lib/auth.ts`) is the only way to get the signed-in user. Magic links use the
  token-hash flow (`/auth/confirm`) so they work across browsers; Google uses PKCE (`/auth/callback`).
  Post-login redirects go through `safeNextPath()`.
- **Domain rules** (`src/lib/domain/`) are pure TypeScript with unit tests: locales, routes, slugs,
  reading time, content text, redirects, Zod schemas. UI and data layers import from here.
- **Unsplash photos** (`src/lib/domain/unsplash.ts`, `src/lib/unsplash/`, `src/components/unsplash/`).
  Their API guidelines are conditions of use, so keep all four: (1) the access key stays on the
  server (`/api/unsplash/search` proxies searches, signed-in only, cached for hours); (2) images are
  hotlinked from `images.unsplash.com`, resized with `unsplashImageUrl()` which keeps the `ixid`
  param (use `UnsplashImage`, never re-host or proxy through `/_next/image`); (3) picking a photo
  calls `trackUnsplashSelection()` (their "download" event); (4) every displayed Unsplash photo gets
  `UnsplashCredit` ("Photo by X on Unsplash" with UTM links). Store `ImageCredit` next to the image
  (`stories.cover_credit`; inline images will carry it as a node attr).
- **Rendering stored content.** `StoryBody` renders Tiptap JSON through an allowlist of node and
  mark types. Never use `dangerouslySetInnerHTML` for user content.

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`. Zod for every input crossing a trust boundary.
- Every feature ships with: types, Zod validation, RLS policy (+ grants), tests (unit, RLS, and e2e
  for flows), and ES + EN strings.
- Styling: Tailwind 4 with tokens in `src/app/globals.css` (light, dark, sepia). Use semantic
  tokens (`bg-background`, `text-muted-foreground`, `text-ember-text`), never raw colors. Every
  text/background pair must pass WCAG AA in all three themes (e2e axe tests check this).
- Skeletons, never spinners. Respect `prefers-reduced-motion` (`motion-safe:` utilities).
- Seed content is original and fictional; seed emails use the reserved `.test` TLD.
- Commit in small steps; never commit `.env*` (only `.env.example`).

## Decisions (and why)

- **Pinned stable lines over brand-new majors**: TypeScript 6.0 (typescript-eslint doesn't support
  7), ESLint 9 (`eslint-config-next` plugins don't support 10), Drizzle 0.45 (1.0 is RC),
  postgres.js 3.4 (4.0 shipped days before Phase 0), Supabase CLI 2.122 (3.0 likewise).
- **npm** over pnpm: preinstalled, nothing extra for contributors or CI.
- **Unprefixed share URLs**: stories have one language; links pasted into WhatsApp/X must be stable.
- **English fallback, browser detection first**: spec says English-first with Spanish as an equal.
- **Campfire vocabulary per locale**: ES UI says Chispas / Lo que arde; EN UI says Sparks /
  Burning now.
- **No "Pro" tier anywhere**: everyone gets everything. Donations will be an external link once the
  platform is picked (Open Collective, GitHub Sponsors or Ko-fi).
- **Dates render in UTC** until readers can choose a time zone (Phase 3 onboarding).
- **Reading speed** 238 wpm (EN) / 218 wpm (ES).
- **Unsplash hotlinking over privacy-maximal re-hosting**: Unsplash requires it. Readers' browsers
  load those images from Unsplash's CDN, which sees their IP. The privacy policy (Phase 5) must say
  so. Unsplash is not an ad network and sets no cookies on image requests.

## Known gaps / follow-ups

- Seed stories are short essays (150–335 words). Phase 1 should add a few 1,500+ word pieces to
  exercise table of contents and reading progress.
- `'use cache'` listings don't know about seed runs: restart `npm run dev` after `npm run db:seed`.
  Phase 1 publish actions must call `revalidateTag("stories")` and the story/profile tags.
- Story/profile 404s inside Suspense are soft 404s (HTTP 200 + noindex). Revisit with
  `generateStaticParams` for popular stories in Phase 1.
- Some corporate mail scanners prefetch links and can burn a magic link. If reported, switch
  `/auth/confirm` to a confirm-button page.
- Google sign-in doesn't yet save the reader's locale on first sign-in (magic links do).
- Turnstile on sign-up, rate limits and new-account limits are not in yet (spec: Trust & safety).
  That includes a per-writer limit on photo searches; today only caching protects the Unsplash quota.
- Unsplash is wired into the style guide only. Phase 1 must add it to the publish flow (cover) and
  the editor (`/` → Unsplash inserts an `image` node with alt text and credit), and extend
  `StoryBody` to render `image` nodes from allowed hosts with their credit.
