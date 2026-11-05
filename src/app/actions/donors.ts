"use server";

import { eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { donorGrantSchema, donorRemoveSchema, type DonorActionResult } from "@/lib/domain/badges";

/**
 * Owner-only donor badge actions. The database functions check the admin role again (from the
 * signed JWT), so these can't be used by anyone else even if called directly.
 */

function refresh(username: string) {
  // Badges show next to bylines on every listing, story, circle and search page.
  updateTag("stories");
  updateTag(`profile:${username.toLowerCase()}`);
}

export async function grantDonorBadge(input: unknown): Promise<DonorActionResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = donorGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const person = await withRls(viewer.claims, async (tx) => {
    const [found] = await tx.execute<{ id: string; username: string; display_name: string }>(
      sql`select id, username, display_name from public.admin_find_profile(${parsed.data.target})`,
    );
    if (!found) return null;
    const [granted] = await tx.execute<{ until: string }>(
      sql`select public.grant_donor_badge(${found.id}::uuid, ${parsed.data.note}) as until`,
    );
    return { ...found, until: granted?.until ? new Date(granted.until).toISOString() : undefined };
  });
  if (!person) return { ok: false, error: "notFound" };

  refresh(person.username);
  return { ok: true, name: person.display_name || person.username, until: person.until };
}

export async function removeDonorBadge(input: unknown): Promise<DonorActionResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "unauthorized" };
  const parsed = donorRemoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const person = await withRls(viewer.claims, async (tx) => {
    const [found] = await tx
      .select({ username: profiles.username, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, parsed.data.userId));
    if (!found) return null;
    await tx.execute(sql`select public.remove_donor_badge(${parsed.data.userId}::uuid)`);
    return found;
  });
  if (!person) return { ok: false, error: "notFound" };

  refresh(person.username);
  return { ok: true, name: person.displayName || person.username };
}
