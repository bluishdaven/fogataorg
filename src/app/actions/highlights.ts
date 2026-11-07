"use server";

import { and, eq } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { highlights, stories } from "@/lib/db/schema";
import type { TiptapDoc } from "@/lib/domain/content";
import { highlightInputSchema, locateQuote } from "@/lib/domain/highlights";
import { blockTexts } from "@/lib/domain/social";
import { allowAction } from "@/lib/limits";

type Fail = { ok: false; error: "unauthorized" | "invalid" | "notFound" | "rateLimited" };

/**
 * Keeps a passage as an ember. The quote must really be in that paragraph of the live story
 * (checked against the stored text), so embers can't carry made-up words.
 */
export async function saveHighlight(input: unknown): Promise<{ ok: true; highlight: { id: string; blockId: string; start: number; end: number; quote: string } } | Fail> {
  const parsed = highlightInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const { storyId, blockId, quote, near } = parsed.data;

  const [story] = await asAnon((tx) => tx.select({ content: stories.content }).from(stories).where(eq(stories.id, storyId)).limit(1));
  if (!story) return { ok: false, error: "notFound" };
  const text = blockTexts(story.content as TiptapDoc)[blockId];
  const passage = text ? locateQuote(text, quote, near) : null;
  if (!passage) return { ok: false, error: "invalid" };
  if (!(await allowAction(viewer, "highlight"))) return { ok: false, error: "rateLimited" };

  const id = await withRls(viewer.claims, async (tx) => {
    const [inserted] = await tx
      .insert(highlights)
      .values({ userId: viewer.id, storyId, blockId, startOffset: passage.start, endOffset: passage.end, quote })
      .onConflictDoNothing()
      .returning({ id: highlights.id });
    if (inserted) return inserted.id;
    const [existing] = await tx
      .select({ id: highlights.id })
      .from(highlights)
      .where(
        and(
          eq(highlights.userId, viewer.id),
          eq(highlights.storyId, storyId),
          eq(highlights.blockId, blockId),
          eq(highlights.startOffset, passage.start),
          eq(highlights.endOffset, passage.end),
        ),
      );
    return existing?.id ?? null;
  });
  if (!id) return { ok: false, error: "invalid" };
  return { ok: true, highlight: { id, blockId, start: passage.start, end: passage.end, quote } };
}

export async function removeHighlight(input: unknown): Promise<{ ok: true } | Fail> {
  const id = typeof input === "object" && input && "id" in input ? String((input as { id: unknown }).id) : "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "invalid" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  await withRls(viewer.claims, (tx) => tx.delete(highlights).where(and(eq(highlights.id, id), eq(highlights.userId, viewer.id))));
  return { ok: true };
}
