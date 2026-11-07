"use server";

import { and, asc, eq, isNull, max, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getViewer, type Viewer } from "@/lib/auth";
import { withRls, type RlsTransaction } from "@/lib/db/rls";
import { series, stories } from "@/lib/db/schema";
import { moveInOrder, seriesInputSchema } from "@/lib/domain/series";
import { slugify, uniqueSlug } from "@/lib/domain/slug";

type Result = { ok: true } | { ok: false; error: "unauthorized" | "invalid" | "title" | "description" | "notFound" };

const id = z.uuid();

function invalidate(viewer: Viewer, seriesId: string) {
  updateTag("stories");
  updateTag(`profile:${viewer.username.toLowerCase()}`);
  updateTag(`series:${seriesId}`);
}

async function withViewer(run: (viewer: Viewer) => Promise<Result>): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  return run(viewer);
}

/** Positions 1…n in the given order. */
async function renumber(tx: RlsTransaction, ids: string[]) {
  for (const [index, storyId] of ids.entries()) {
    await tx.update(stories).set({ seriesPosition: index + 1 }).where(eq(stories.id, storyId));
  }
}

async function partsOf(tx: RlsTransaction, seriesId: string) {
  return tx
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.seriesId, seriesId), isNull(stories.deletedAt)))
    .orderBy(asc(stories.seriesPosition), asc(stories.createdAt));
}

export async function createSeries(input: unknown): Promise<Result> {
  const parsed = seriesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "description" ? "description" : "title" };
  return withViewer(async (viewer) => {
    const newId = await withRls(viewer.claims, async (tx) => {
      const slug = await uniqueSlug(slugify(parsed.data.title) || "series", async (candidate) => {
        const [taken] = await tx.select({ id: series.id }).from(series).where(and(eq(series.authorId, viewer.id), eq(series.slug, candidate))).limit(1);
        return Boolean(taken);
      });
      const [row] = await tx.insert(series).values({ authorId: viewer.id, slug, ...parsed.data }).returning({ id: series.id });
      return row!.id;
    });
    invalidate(viewer, newId);
    return { ok: true };
  });
}

export async function updateSeries(input: unknown): Promise<Result> {
  const parsed = seriesInputSchema.extend({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "description" ? "description" : "title" };
  return withViewer(async (viewer) => {
    const { id: seriesId, title, description } = parsed.data;
    await withRls(viewer.claims, (tx) => tx.update(series).set({ title, description }).where(and(eq(series.id, seriesId), eq(series.authorId, viewer.id))));
    invalidate(viewer, seriesId);
    return { ok: true };
  });
}

/** Deletes the series; its stories stay, just no longer grouped. */
export async function deleteSeries(input: unknown): Promise<Result> {
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return withViewer(async (viewer) => {
    await withRls(viewer.claims, (tx) => tx.delete(series).where(and(eq(series.id, parsed.data.id), eq(series.authorId, viewer.id))));
    invalidate(viewer, parsed.data.id);
    return { ok: true };
  });
}

/** Adds one of the writer's stories at the end of one of their series. */
export async function addStoryToSeries(input: unknown): Promise<Result> {
  const parsed = z.object({ seriesId: id, storyId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return withViewer(async (viewer) => {
    const { seriesId, storyId } = parsed.data;
    const ok = await withRls(viewer.claims, async (tx) => {
      const [owned] = await tx.select({ id: series.id }).from(series).where(and(eq(series.id, seriesId), eq(series.authorId, viewer.id))).limit(1);
      if (!owned) return false;
      const [last] = await tx.select({ position: max(stories.seriesPosition) }).from(stories).where(and(eq(stories.seriesId, seriesId), ne(stories.id, storyId)));
      const updated = await tx
        .update(stories)
        .set({ seriesId, seriesPosition: (last?.position ?? 0) + 1 })
        .where(and(eq(stories.id, storyId), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
        .returning({ id: stories.id });
      return updated.length > 0;
    });
    if (!ok) return { ok: false, error: "notFound" };
    invalidate(viewer, seriesId);
    return { ok: true };
  });
}

export async function removeStoryFromSeries(input: unknown): Promise<Result> {
  const parsed = z.object({ storyId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return withViewer(async (viewer) => {
    const seriesId = await withRls(viewer.claims, async (tx) => {
      const [story] = await tx
        .select({ seriesId: stories.seriesId })
        .from(stories)
        .where(and(eq(stories.id, parsed.data.storyId), eq(stories.authorId, viewer.id)))
        .limit(1);
      if (!story?.seriesId) return null;
      await tx.update(stories).set({ seriesId: null, seriesPosition: null }).where(eq(stories.id, parsed.data.storyId));
      await renumber(tx, (await partsOf(tx, story.seriesId)).map((part) => part.id));
      return story.seriesId;
    });
    if (!seriesId) return { ok: false, error: "notFound" };
    invalidate(viewer, seriesId);
    return { ok: true };
  });
}

export async function moveStoryInSeries(input: unknown): Promise<Result> {
  const parsed = z.object({ storyId: id, direction: z.enum(["up", "down"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return withViewer(async (viewer) => {
    const seriesId = await withRls(viewer.claims, async (tx) => {
      const [story] = await tx
        .select({ seriesId: stories.seriesId })
        .from(stories)
        .where(and(eq(stories.id, parsed.data.storyId), eq(stories.authorId, viewer.id)))
        .limit(1);
      if (!story?.seriesId) return null;
      const order = moveInOrder(await partsOf(tx, story.seriesId), parsed.data.storyId, parsed.data.direction);
      await renumber(tx, order.map((part) => part.id));
      return story.seriesId;
    });
    if (!seriesId) return { ok: false, error: "notFound" };
    invalidate(viewer, seriesId);
    return { ok: true };
  });
}
