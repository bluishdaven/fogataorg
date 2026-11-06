# Idea: automated daily-note accounts (parked)

Status: idea only, parked by the owner on 2026-11-06. Nothing built.

Two accounts that publish one note a day each: a world-news briefing written in a journalist's
voice, and a spirituality/wellness note written in a wellness professional's voice.

## How it would work

- A daily Vercel Cron route asks the Claude API (Anthropic, `@anthropic-ai/sdk`) to write each
  note, then publishes it as a normal story through the usual sanitizer and publish path.
- News: Claude's server-side web search, limited to reputable outlets (`allowed_domains`), 600–900
  words in its own words, ending with links to every source. Wellness: no web search, no medical
  claims.
- Optional Unsplash cover through the existing search, with credit.

## Guardrails agreed in discussion

- Clearly labelled "Automated" on the account and every note; written in the style of a
  journalist / wellness professional, never presented as a real person.
- Kept out of the home feed ("Daily notes" section, topics, followers instead), no writing badges,
  an admin pause switch, normal moderation applies.
- The owner signs up the two accounts with addresses they control; an admin flag marks them as
  automated. Claude never creates accounts on the live site.

## Open decisions before building

- Approve the paid service: Claude API, roughly $10–20/month on Opus 5.5 (Nov 2026 list prices:
  $4 / $20 per MTok, web search $10 per 1,000 searches); a smaller model roughly halves it.
- Language: Spanish, English or both (both doubles posts and cost).
- Check the cron route fits the Vercel plan's function time limit (web search runs can take
  minutes); fall back to the Batch API or a two-step job if not.
