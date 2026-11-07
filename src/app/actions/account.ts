"use server";

import { sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { confirmsUsername, deleteAccountSchema, type DeleteAccountResult } from "@/lib/domain/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKETS = ["avatars", "story-images"] as const;

/**
 * Deletes the signed-in person's account: their uploaded files first (through the Storage API, with
 * their own session), then the account itself, which cascades to everything else. Signs them out.
 */
export async function deleteAccount(input: unknown): Promise<DeleteAccountResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success || !confirmsUsername(parsed.data.confirm, viewer.username)) return { ok: false, error: "mismatch" };

  const supabase = await createSupabaseServerClient();
  try {
    for (const bucket of BUCKETS) {
      const storage = supabase.storage.from(bucket);
      // Files live flat in <user id>/; list in pages until the folder is empty.
      for (let round = 0; round < 50; round += 1) {
        const { data, error } = await storage.list(viewer.id, { limit: 1000 });
        if (error) throw error;
        const files = (data ?? []).filter((item) => item.id).map((item) => `${viewer.id}/${item.name}`);
        if (!files.length) break;
        const removed = await storage.remove(files);
        if (removed.error) throw removed.error;
      }
    }
    await withRls(viewer.claims, (tx) => tx.execute(sql`select public.delete_own_account()`));
  } catch (error) {
    console.error("account deletion failed", error);
    return { ok: false, error: "failed" };
  }

  await supabase.auth.signOut({ scope: "local" });
  updateTag("stories");
  updateTag("circles");
  updateTag(`profile:${viewer.username.toLowerCase()}`);
  redirect(`/${parsed.data.locale}`);
}
