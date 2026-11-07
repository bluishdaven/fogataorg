import "server-only";
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import type { db as ownerDb } from "@/lib/db/client";

const CHUNK = 100;

/** The secret (service role) key; only this job uses it. Unset turns the cleanup off. */
export function storageSecretKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || null;
}

/**
 * Removes uploaded files nothing points to any more (`public.orphaned_uploads()`: older than a
 * day, at most 500 a run) through the Storage API, which deletes the file and its row together.
 * Run by the daily cron; failures are logged and retried the next day.
 */
export async function removeOrphanedUploads(
  db: typeof ownerDb,
  { supabaseUrl, secretKey }: { supabaseUrl: string; secretKey: string | null },
): Promise<{ removed: number; failed: number } | { skipped: "not_configured" }> {
  if (!secretKey) return { skipped: "not_configured" };
  const rows = await db.execute<{ bucket: string; name: string }>(sql`select bucket, name from public.orphaned_uploads()`);
  const byBucket = new Map<string, string[]>();
  for (const row of rows) byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row.name]);

  const storage = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  let removed = 0;
  let failed = 0;
  for (const [bucket, names] of byBucket) {
    for (let start = 0; start < names.length; start += CHUNK) {
      const chunk = names.slice(start, start + CHUNK);
      const { data, error } = await storage.from(bucket).remove(chunk);
      if (error) {
        console.error("[storage] cleanup failed", bucket, error.message);
        failed += chunk.length;
      } else {
        removed += data.length;
      }
    }
  }
  return { removed, failed };
}
