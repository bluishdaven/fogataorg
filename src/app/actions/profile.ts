"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { avatarUpdateSchema, isOwnAvatarUrl, type AvatarUpdateResult } from "@/lib/domain/avatars";
import { publicEnv } from "@/lib/env";
import {
  profileUpdateSchema,
  type ProfileErrorKey,
  type ProfileUpdateInput,
  type ProfileUpdateResult,
} from "@/lib/domain/profile";

const FIELD_ERRORS = new Set<ProfileErrorKey>([
  "displayName",
  "username",
  "usernameReserved",
  "bio",
  "linkLabel",
  "linkUrl",
  "tooManyLinks",
  "pronouns",
  "nowText",
  "influence",
  "tooManyInfluences",
]);

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<ProfileUpdateResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const errors = new Set<ProfileErrorKey>(
      parsed.error.issues.map((issue) =>
        FIELD_ERRORS.has(issue.message as ProfileErrorKey) ? (issue.message as ProfileErrorKey) : "invalid",
      ),
    );
    return { ok: false, errors: [...errors] };
  }

  const { displayName, username, bio, links, pronouns, nowFocus, nowText, influences } = parsed.data;
  try {
    await withRls(viewer.claims, (tx) =>
      tx
        .update(profiles)
        .set({ displayName, username, bio, links, pronouns, nowFocus, nowText, influences })
        .where(eq(profiles.id, viewer.id)),
    );
  } catch (error) {
    if (pgCode(error) === "23505") return { ok: false, errors: ["usernameTaken"] };
    if (pgCode(error) === "23514") return { ok: false, errors: ["username"] };
    throw error;
  }

  // Bylines appear on every listing and story page; "stories" covers all of them.
  updateTag("stories");
  updateTag(`profile:${viewer.username.toLowerCase()}`);
  updateTag(`profile:${username.toLowerCase()}`);
  return { ok: true, username };
}

/**
 * Saves (or clears) the signed-in user's profile photo. The browser uploads the
 * cropped WebP to avatars/<user id>/ first; only a URL in that folder is accepted
 * (the database checks the same rule).
 */
export async function updateAvatar(input: unknown): Promise<AvatarUpdateResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const parsed = avatarUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { avatarUrl } = parsed.data;
  if (avatarUrl !== null && !isOwnAvatarUrl(avatarUrl, publicEnv.NEXT_PUBLIC_SUPABASE_URL, viewer.id)) {
    return { ok: false, error: "invalid" };
  }

  await withRls(viewer.claims, (tx) => tx.update(profiles).set({ avatarUrl }).where(eq(profiles.id, viewer.id)));

  // Avatars appear next to bylines on every listing and story page.
  updateTag("stories");
  updateTag(`profile:${viewer.username.toLowerCase()}`);
  return { ok: true };
}
