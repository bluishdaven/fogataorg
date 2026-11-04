# Setup

## Local development

Requirements: Node 24, Docker (running), Git.

```bash
npm install
npm run setup     # starts Supabase, writes .env.local, applies migrations, seeds 20 stories
npm run dev       # http://localhost:3000
```

- Sign in at `/en/login` with any address; the magic link lands in Mailpit at
  http://127.0.0.1:54324. Seeded writers use `*@fogata.test` addresses.
- Supabase Studio: http://127.0.0.1:54323.
- Stop the stack with `npm run db:stop`. `npm run setup` is safe to re-run.
- After re-seeding, restart `npm run dev` (cached listings don't know about seed runs).

### Google sign-in locally

1. Create an OAuth client (Web application) in Google Cloud Console. Authorized redirect URI:
   `http://127.0.0.1:54321/auth/v1/callback`.
2. Add to `.env.local` (or your shell) and restart Supabase:
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…`.
3. In `supabase/config.toml`, set `[auth.external.google] enabled = true`.
4. Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in `.env.local`.

## Deploying (owner steps, not automated)

These need accounts only the project owner can create. Free tiers work for previews; see the
cost notes at the end before launch.

### 1. GitHub

Create a repository and push `main`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit
tests and a runtime dependency audit, then RLS and e2e tests against a throwaway local Supabase.

### 2. Supabase project

1. Create a project (pick the region closest to most readers, e.g. `us-east-1` for MX + US).
2. Link and push migrations from your machine:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
3. **Authentication → URL configuration**: Site URL `https://fogata.org`; redirect URLs
   `https://fogata.org/**` and `https://*-<vercel-team>.vercel.app/**` (previews).
4. **Authentication → Email templates**: paste `supabase/templates/magic_link.html` into *Magic
   Link* and `supabase/templates/confirmation.html` into *Confirm signup* (subjects are in
   `supabase/config.toml`). They link to `/auth/confirm` with a token hash.
5. **Authentication → SMTP**: Supabase's built-in mailer is for testing only (a few emails per
   hour). Configure a real SMTP provider before inviting anyone.
6. **Google provider**: enable it with your Google client; add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI in Google.
7. Copy the **publishable key**, **secret key** and the **transaction pooler** connection string
   (port 6543) for Vercel.

Never run `npm run db:seed` against production; it refuses unless you pass `--allow-remote`.

### 3. Vercel

1. Import the GitHub repository. Framework preset: Next.js. Every PR gets a preview deploy.
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://fogata.org` (Production) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | `true` once Google is configured |
   | `DATABASE_URL` | transaction pooler URL (port 6543) |

   The secret key is **not** needed by the app; keep it out of Vercel until a feature needs it.
3. `next build` reads published stories to prerender listings, so the build needs `DATABASE_URL`.
4. Add the `fogata.org` domain.

### Cost notes

- Supabase Free pauses projects after 7 days without activity and has no image transformations;
  expect Supabase Pro for launch.
- Supabase's built-in email is rate-limited to a few messages per hour; production needs SMTP
  (Resend is in the spec; its free tier allows 100 emails/day).
- Vercel Hobby is for non-commercial use; confirm a donation-funded .org qualifies before launch.
