"use server";

import { sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { moderateStorySchema, type ModerationResult } from "@/lib/domain/moderation";

/**
 * Admin-only. The database function checks the admin role again from the signed JWT, so this
 * can't be used by anyone else even if called directly.
 */
export async function moderateStory(input: unknown): Promise<ModerationResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = moderateStorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.message === "reasonRequired") ? "reasonRequired" : "failed" };
  }
  const { storyId, status, reason } = parsed.data;
  try {
    await withRls(viewer.claims, (tx) =>
      tx.execute(sql`select public.moderate_story(${storyId}::uuid, ${status}::public.moderation_status, ${reason})`),
    );
  } catch {
    return { ok: false, error: "failed" };
  }
  // Every listing, story page, profile, topic, circle and search result is tagged "stories".
  updateTag("stories");
  return { ok: true };
}
