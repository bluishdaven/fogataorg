import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { profiles, prompts, stories } from "@/lib/db/schema";
import { cardColumns, inFeeds, toCard } from "./stories";

const entries = sql<number>`(select count(*)::int from public.stories s where s.prompt_id = "prompts"."id" and s.status = 'published' and s.deleted_at is null and s.published_at <= now() and not exists (select 1 from public.story_moderation sm where sm.story_id = s.id))`;
const columns = { id: prompts.id, weekOf: prompts.weekOf, textEn: prompts.textEn, textEs: prompts.textEs, entries };

/** This week's spark (weeks start Monday, UTC), if there is one. Re-checked hourly. */
export async function getCurrentPrompt() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
  cacheTag("prompts", "stories");
  const [row] = await asAnon((tx) =>
    tx
      .select(columns)
      .from(prompts)
      .where(sql`${prompts.weekOf} = date_trunc('week', now() at time zone 'utc')::date`)
      .limit(1),
  );
  return row ?? null;
}

/** Every spark that has started, newest first, with how many entries each has. */
export async function listPastPrompts() {
  "use cache";
  cacheLife("hours");
  cacheTag("prompts", "stories");
  return asAnon((tx) => tx.select(columns).from(prompts).orderBy(desc(prompts.weekOf)).limit(200));
}

/** One spark and its entries (published stories written for it), newest first. */
export async function getPromptPage(week: string) {
  "use cache";
  cacheTag("prompts", "stories");
  const result = await asAnon(async (tx) => {
    const [prompt] = await tx.select(columns).from(prompts).where(eq(prompts.weekOf, week)).limit(1);
    if (!prompt) return null;
    const rows = await tx
      .select(cardColumns)
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(inFeeds, eq(stories.promptId, prompt.id)))
      .orderBy(desc(stories.publishedAt))
      .limit(100);
    return { ...prompt, stories: rows.map(toCard) };
  });
  if (result) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

/** All sparks, upcoming ones included, for the admin page. */
export async function listAdminPrompts(viewer: Viewer) {
  return withRls(viewer.claims, (tx) => tx.select(columns).from(prompts).orderBy(desc(prompts.weekOf)));
}
