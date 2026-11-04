# Changelog

## Phase 0 — Foundation (2026-11-04)

**Demo** (after `npm run setup && npm run dev`):

1. Open http://localhost:3000. You land on `/en` or `/es` depending on your browser language.
2. The home page lists 17 published stories from 8 writers, in Spanish and English. Drafts and
   the unlisted story don't appear.
3. Open any story. The URL is the share URL (`/@lucia_ortega/el-mole-de-mi-abuela-no-tiene-receta`)
   and the UI around it follows your language choice; the story keeps its own `lang`.
4. Switch language and theme (light, dark, sepia) from the header. Both stick across reloads.
5. Sign in from the header with any email; open the link from Mailpit (http://127.0.0.1:54324).
   You come back signed in with a profile created from your email. Sign out from the avatar menu.
6. `/en/design` is the living style guide: tokens, type scale, reading measure, components and
   the campfire vocabulary.

**What's in**

- Next.js 16.4 (App Router, Cache Components), TypeScript strict, Tailwind 4, shadcn/ui on Radix.
- Design tokens for light, dark and sepia; Source Serif 4 for reading, Inter for UI; animated flame
  that respects reduced motion.
- next-intl with `/en` and `/es` UI routes and unprefixed `/@handle` share URLs.
- Supabase Auth: magic link (token-hash, email templates in ES and EN) and Google (behind a flag).
- Drizzle schema and migrations for `profiles`, `topics`, `stories`, `story_topics`, with RLS
  policies, column grants, a sign-up trigger, and a 5-topic limit.
- `withRls()` so every app query runs under Supabase roles.
- Seed: 8 fictional writers, 14 topics (names in ES and EN), 20 original stories (10 ES, 10 EN; 17 published,
  2 drafts, 1 unlisted). Refuses to run against a non-local database.
- Tests: 59 unit/component, 16 RLS, 38 Playwright (including the full magic-link flow and axe
  WCAG A/AA scans of six pages in all three themes).
- CI: lint, typecheck, unit tests, runtime dependency audit; RLS and e2e against a throwaway
  Supabase stack.

**Not yet**

- Vercel and Supabase cloud aren't connected (owner steps in `docs/SETUP.md`).
- See "Known gaps / follow-ups" in `CLAUDE.md`.
