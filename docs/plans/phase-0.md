# Phase 0 — Foundation

Goal: a deployable skeleton where every later feature has a home. Readers can switch language and
theme, sign in with a magic link (Google when credentials exist), and browse 20 seeded stories in
Spanish and English. Lint, typecheck, unit, RLS and e2e tests run locally and in CI.

## Decisions made before building

| Decision | Choice | Why |
| --- | --- | --- |
| Package manager | npm | Already installed; nothing extra for contributors or CI. |
| TypeScript | 6.0.x (not 7.x) | typescript-eslint supports `<6.1`; TS 7 would break linting. |
| ESLint | 9.39.x (not 10) | `eslint-config-next` plugins (react, import, jsx-a11y) don't support ESLint 10 yet. |
| Drizzle | 0.45 stable (not 1.0 rc) | 1.0 is still a release candidate and changes the migrations layout. |
| postgres.js | 3.4.x (not 4.0) | 4.0 shipped six days before this phase; wait for it to settle. |
| Supabase CLI | 2.122 stable channel (not 3.0) | 3.0 shipped two days before this phase. |
| Rendering | Cache Components on (`cacheComponents` + `partialPrefetching`) | Next 16.4 default and the model the next major makes mandatory. Story pages become a cached static shell with viewer state streaming in, which is exactly the spec's performance target. |
| Story / profile URLs | `/@handle` and `/@handle/slug`, no locale prefix | A story has one language; share links must be stable. The proxy rewrites them to `/{locale}/u/...` internally, picking the locale from the `NEXT_LOCALE` cookie, then `Accept-Language`. |
| UI URLs | `/en/...` and `/es/...` | SEO and hreflang for UI pages. Localized path names (e.g. `/es/explorar`) deferred until there are pages worth translating. |
| Default locale | Detect from `Accept-Language`, fall back to English | Spec says English-first with Spanish as an equal citizen. |
| Campfire vocabulary | Spanish UI uses Chispas / Lo que arde; English UI uses Sparks / Burning now | Avoids a half-translated English UI. |
| "Pro" tier | None in schema or UI | Everyone gets everything; a "Support Fogata" donation link comes once the donation platform is chosen. |
| RLS enforcement | App queries run in a transaction as `anon`/`authenticated` with JWT claims set (`withRls`) | Drizzle's direct connection is a superuser and would otherwise bypass every policy. |
| Column privileges | `authenticated` can only update whitelisted profile columns | RLS can't restrict columns; stops users setting `is_verified` through the Data API. |
| Magic links | Token-hash links to `/auth/confirm` | Works when the email is opened in a different browser or device (PKCE links don't). |
| Migrations | Drizzle schema → `drizzle-kit generate` → `supabase/migrations` → applied by Supabase CLI | One source of truth for tables and policies; Supabase CLI owns applying them locally and in the cloud. |

## Files

- `src/proxy.ts` — locale routing (next-intl), `/@handle` rewrite, Supabase session refresh.
- `src/i18n/*`, `messages/{en,es}.json` — routing, request config, typed messages.
- `src/app/[locale]/` — root layout (fonts, theme, header, footer), home, login, `/design`,
  `u/[handle]` profile stub and `u/[handle]/[slug]` basic story view.
- `src/app/auth/{confirm,callback}/route.ts` — magic link and OAuth landing.
- `src/lib/supabase/*` — server, browser and proxy clients.
- `src/lib/db/*` — Drizzle schema, client, `withRls`.
- `src/lib/domain/*` — slugs, reading time, content helpers, auth/redirect rules, Zod schemas.
- `src/components/*` — flame logo, header, theme and language switchers, story card.
- `scripts/seed/*` — 8 writers, 14 topics, 20 stories (ES and EN), local-only guard.
- `tests/unit`, `tests/db` (RLS), `tests/e2e` (Playwright).
- `.github/workflows/ci.yml`, `.env.example`, `CLAUDE.md`, `docs/SETUP.md`, `docs/CHANGELOG.md`.

## Tables (this phase)

- `profiles` — created by trigger on `auth.users` insert; case-insensitive unique username.
- `topics` — names in ES and EN; read-only for users.
- `stories` — Tiptap JSON + plain text, status, language, soft delete, unique slug per author.
- `story_topics` — join table, max 5 topics per story enforced by trigger.

Later tables (sparks, follows, responses, highlights, read events…) arrive with their phases.

## Risks

- **next-intl + Cache Components**: locale must come from the `[locale]` root param with
  `generateStaticParams`, and every request read (cookies, session) must sit inside `<Suspense>`.
- **Session UI in the header**: reading cookies in the layout would make every page dynamic, so the
  account menu streams in behind a Suspense boundary.
- **Seed needs real auth users**: created through the Supabase admin API; the seed refuses to run
  against a non-local database.
- **Google sign-in**: can't be exercised without OAuth credentials; the button only shows when
  `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
- **Deploys**: Vercel and Supabase cloud need accounts the owner creates; documented in
  `docs/SETUP.md`, not automated here.
