"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { getVersion, listVersions } from "@/lib/data/versions";
import { withRls } from "@/lib/db/rls";
import { stories, storyVersions } from "@/lib/db/schema";
import { countWords, readingTimeMinutes, tiptapToText, type TiptapDoc } from "@/lib/domain/content";
import { sanitizeStoryDoc } from "@/lib/domain/story-doc";
import { allowedImagePrefixes } from "@/lib/story-images";

const id = z.uuid();

export type VersionSummary = { id: string; kind: "draft" | "published"; title: string; wordCount: number; createdAt: string; updatedAt: string };

/** The writer's version history for one story, newest first. */
export async function listStoryVersions(storyId: unknown): Promise<VersionSummary[]> {
  const viewer = await getViewer();
  if (!viewer || !id.safeParse(storyId).success) return [];
  const rows = await listVersions(viewer, storyId as string);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

export async function getStoryVersion(versionId: unknown): Promise<{ title: string; subtitle: string; content: TiptapDoc } | null> {
  const viewer = await getViewer();
  if (!viewer || !id.safeParse(versionId).success) return null;
  const version = await getVersion(viewer, versionId as string);
  // Plain JSON for the client.
  return version ? JSON.parse(JSON.stringify({ title: version.title, subtitle: version.subtitle, content: version.content })) : null;
}

/**
 * Brings a version back: into the draft, or into the pending changes of a live story (published
 * only with "Publish changes"). The current text is kept as a version first, so restoring can be
 * undone from the same list.
 */
export async function restoreStoryVersion(input: unknown): Promise<{ ok: boolean }> {
  const parsed = z.object({ storyId: id, versionId: id }).safeParse(input);
  const viewer = await getViewer();
  if (!parsed.success || !viewer) return { ok: false };
  const { storyId, versionId } = parsed.data;
  const version = await getVersion(viewer, versionId);
  if (!version || version.storyId !== storyId) return { ok: false };
  const content = sanitizeStoryDoc(version.content, allowedImagePrefixes());

  return withRls(viewer.claims, async (tx) => {
    const [story] = await tx
      .select({ status: stories.status, title: stories.title, subtitle: stories.subtitle, content: stories.content, language: stories.language, pendingChanges: stories.pendingChanges })
      .from(stories)
      .where(and(eq(stories.id, storyId), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .limit(1);
    if (!story) return { ok: false };
    const current = (story.status !== "draft" && story.pendingChanges ? story.pendingChanges : story) as { title: string; subtitle: string; content: TiptapDoc };
    const text = tiptapToText(content);
    // The text being replaced is kept first, unless the newest version already holds it; then the
    // restored text gets its own row (later saves update that row, never the safety copy).
    const [latest] = await tx
      .select({ title: storyVersions.title, subtitle: storyVersions.subtitle, content: storyVersions.content })
      .from(storyVersions)
      .where(eq(storyVersions.storyId, storyId))
      .orderBy(desc(storyVersions.createdAt))
      .limit(1);
    const alreadyKept =
      latest && latest.title === current.title && latest.subtitle === current.subtitle && JSON.stringify(latest.content) === JSON.stringify(current.content);
    if (!alreadyKept) await tx.insert(storyVersions).values({
      storyId,
      kind: "draft",
      title: current.title,
      subtitle: current.subtitle,
      content: current.content,
      wordCount: countWords(tiptapToText(current.content)),
      createdAt: sql`now() - interval '1 millisecond'`,
    });
    await tx.insert(storyVersions).values({ storyId, kind: "draft", title: version.title, subtitle: version.subtitle, content, wordCount: countWords(text) });
    await tx
      .update(stories)
      .set({
        ...(story.status === "draft"
          ? { title: version.title, subtitle: version.subtitle, content, contentText: text, readingTime: readingTimeMinutes(text, story.language) }
          : { pendingChanges: { title: version.title, subtitle: version.subtitle, content } }),
        revision: sql`${stories.revision} + 1`,
      })
      .where(eq(stories.id, storyId));
    return { ok: true };
  });
}
