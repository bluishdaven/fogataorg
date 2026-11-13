"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { pushSoon } from "@/lib/push/soon";
import { withRls } from "@/lib/db/rls";
import { pgCode } from "@/lib/db/errors";
import { profiles, promptFeatures, prompts, stories } from "@/lib/db/schema";
import { featureInputSchema, promptInputSchema } from "@/lib/domain/prompts";

type Result = { ok: true } | { ok: false; error: "unauthorized" | "weekOf" | "text" | "invalid" | "limit" };

/** Adds or rewrites the spark for a week (admins only; RLS checks too). */
export async function savePrompt(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = promptInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "weekOf" ? "weekOf" : "text" };
  const { weekOf, textEn, textEs } = parsed.data;
  await withRls(viewer.claims, (tx) =>
    tx
      .insert(prompts)
      .values({ weekOf, textEn, textEs, createdBy: viewer.id })
      .onConflictDoUpdate({ target: prompts.weekOf, set: { textEn, textEs } }),
  );
  updateTag("prompts");
  return { ok: true };
}

export async function deletePrompt(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await withRls(viewer.claims, (tx) => tx.delete(prompts).where(eq(prompts.id, parsed.data.id)));
  updateTag("prompts");
  return { ok: true };
}

/** A writer's story stops answering the spark it started from. */
export async function detachPrompt(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const parsed = z.object({ storyId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await withRls(viewer.claims, (tx) =>
    tx.update(stories).set({ promptId: null }).where(and(eq(stories.id, parsed.data.storyId), eq(stories.authorId, viewer.id))),
  );
  updateTag("prompts");
  return { ok: true };
}

/**
 * Features a weekly spark entry on the spark's page, or takes it back (admins only; RLS checks too).
 * The database keeps features on live entries of that spark, at most three, and tells the writer.
 */
export async function setFeatured(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = featureInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { promptId, storyId, featured } = parsed.data;
  let story: { handle: string; slug: string } | undefined;
  try {
    story = await withRls(viewer.claims, async (tx) => {
      if (featured) {
        await tx.insert(promptFeatures).values({ promptId, storyId }).onConflictDoNothing({ target: promptFeatures.storyId });
      } else {
        await tx.delete(promptFeatures).where(and(eq(promptFeatures.promptId, promptId), eq(promptFeatures.storyId, storyId)));
      }
      const [row] = await tx
        .select({ handle: profiles.username, slug: stories.slug })
        .from(stories)
        .innerJoin(profiles, eq(profiles.id, stories.authorId))
        .where(eq(stories.id, storyId))
        .limit(1);
      return row;
    });
  } catch (error) {
    if (pgCode(error) === "23514") return { ok: false, error: "limit" };
    throw error;
  }
  updateTag("prompts");
  if (story) updateTag(`story:${story.handle.toLowerCase()}/${story.slug}`);
  if (featured) pushSoon();
  return { ok: true };
}
