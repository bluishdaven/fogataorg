"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { prompts, stories } from "@/lib/db/schema";
import { promptInputSchema } from "@/lib/domain/prompts";

type Result = { ok: true } | { ok: false; error: "unauthorized" | "weekOf" | "text" | "invalid" };

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
