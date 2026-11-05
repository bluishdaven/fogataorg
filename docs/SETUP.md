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
- Activity summary emails also land in Mailpit (no Resend key needed locally). Send them now with
  `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/notification-emails`
  (the secret is in `.env.local`). Notifications younger than 10 minutes wait for the next run.
- Stop the stack with `npm run db:stop`. `npm run setup` is safe to re-run.
- After re-seeding, restart `npm run dev` (cached listings don't know about seed runs).

### Google sign-in locally

1. Create an OAuth client (Web application) in Google Cloud Console. Authorized redirect URI:
   `http://127.0.0.1:54321/auth/v1/callback`.
2. Add to `.env.local` (or your shell) and restart Supabase:
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…`.
3. In `supabase/config.toml`, set `[auth.external.google] enabled = true`.
4. Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in `.env.local`.

### Unsplash photo search

Writers can search Unsplash for cover and inline photos. Without a key the picker shows
"Photo search isn't set up yet."

1. Create an app at https://unsplash.com/oauth/applications (free). It starts in **demo mode**:
   50 API requests per hour, which is plenty for development since searches are cached.
2. Put the **Access Key** in `.env.local` as `UNSPLASH_ACCESS_KEY=…` and restart `npm run dev`.
   Try it at `/en/design` → Image search (you need to be signed in).
3. Spanish searches: email api@unsplash.com with your application ID to enable the `lang` beta,
   then set `UNSPLASH_LANG_BETA=true`. Until then, Spanish queries are matched as if they were
   English and results can be weaker.
4. Before launch, apply for **production** access (1,000 requests/hour) from the app's page. Unsplash
   reviews that we hotlink their image URLs, report downloads when a photo is picked, and credit
   photographers. All three are built in.

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
   Migrations also create the `story-images` storage bucket and its policies.
3. **Authentication → URL configuration**: Site URL `https://fogata.org`; redirect URLs
   `https://fogata.org/**` and `https://*-<vercel-team>.vercel.app/**` (previews).
4. **Authentication → Email templates**: paste `supabase/templates/magic_link.html` into *Magic
   Link* and `supabase/templates/confirmation.html` into *Confirm signup* (subjects are in
   `supabase/config.toml`). They link to `/auth/confirm` with a token hash.
5. **Authentication → SMTP**: Supabase's built-in mailer is for testing only (a few emails per
   hour). Point it at Resend (step 4 below): host `smtp.resend.com`, port `465`, user `resend`,
   password = a Resend API key, sender = the same address as `EMAIL_FROM`.
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
   | `UNSPLASH_ACCESS_KEY` | Unsplash access key (optional) |
   | `UNSPLASH_LANG_BETA` | `true` once Unsplash enables the `lang` beta |
   | `RESEND_API_KEY` | Resend API key with sending access (step 4) |
   | `EMAIL_FROM` | `Fogata <hola@fogata.org>` (a verified Resend domain) |
   | `EMAIL_SIGNING_SECRET` | `openssl rand -base64 32`; signs unsubscribe links, keep it stable |
   | `CRON_SECRET` | `openssl rand -base64 32`; Vercel Cron sends it to the summary route |

   The secret key is **not** needed by the app; keep it out of Vercel until a feature needs it.
3. `next build` reads published stories to prerender listings, so the build needs `DATABASE_URL`.
4. Add the `fogata.org` domain.
5. `vercel.json` schedules `/api/cron/notification-emails` daily at 16:00 UTC (10:00 in Mexico City,
   17:00/18:00 in Madrid). Hobby allows daily crons only and may run them any time within that
   hour, which the job tolerates. Vercel adds the `CRON_SECRET` bearer header itself.

### 4. Email (Resend)

Fogata sends one kind of email itself: a batched activity summary (at most one a day by default,
or weekly, or off, chosen in **Settings → Email**). Magic links come from Supabase Auth, which can
use Resend's SMTP (step 2.5 above).

1. Create a Resend account and add the `fogata.org` domain. Add the DNS records it shows (SPF and
   DKIM) and a DMARC record, e.g. `v=DMARC1; p=none; rua=mailto:<you>`. Wait until it's verified.
2. Create an API key with **sending access** only, for that domain. Put it in Vercel as
   `RESEND_API_KEY`, and set `EMAIL_FROM`, `EMAIL_SIGNING_SECRET` and `CRON_SECRET` (table above).
3. Trigger a run by hand to check it:
   `curl -H "Authorization: Bearer <CRON_SECRET>" https://fogata.org/api/cron/notification-emails`
   returns `{"sent":…,"failed":…,"skipped":…}`; failures are logged in Vercel with the user id.
4. Every summary carries `List-Unsubscribe` and `List-Unsubscribe-Post` (one-click, RFC 8058),
   which Gmail and Yahoo require of bulk senders. The footer link opens a confirm page instead,
   because mail scanners prefetch links.

Previews share production's Resend key only if you add it to the Preview environment; leave it out
so preview deploys never email real readers (their cron doesn't run anyway).

### Cost notes

- Supabase Free pauses projects after 7 days without activity and has no image transformations;
  expect Supabase Pro for launch.
- Supabase's built-in email is rate-limited to a few messages per hour; production needs SMTP
  (Resend, step 4).
- Resend's free tier allows 3,000 emails a month and 100 a day, shared by magic links and summaries.
  Summaries go out in one daily run, so once more than ~80 readers have something new on the same
  day, that run hits the daily cap (the rest are retried the next day). Plan on Resend Pro then;
  it's a paid service, so decide before launch.
- Vercel Hobby is for non-commercial use; confirm a donation-funded .org qualifies before launch.
