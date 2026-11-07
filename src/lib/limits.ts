import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { LIMITS, limitFor, type LimitedAction } from "@/lib/domain/limits";

/** Counts one `action` for the signed-in person; false once they've reached the limit. */
export async function allowAction(viewer: Viewer, action: LimitedAction): Promise<boolean> {
  const limit = limitFor(action, viewer.createdAt, new Date());
  const [row] = await withRls(viewer.claims, (tx) =>
    tx.execute<{ ok: boolean }>(sql`select public.take_rate_limit(${action}, ${viewer.id}, ${limit.max}, ${limit.per}::interval) as ok`),
  );
  return row?.ok !== false;
}

/** Same for someone not signed in, keyed by a hash of their IP address (never stored raw). */
export async function allowAnonymous(action: LimitedAction, ip: string): Promise<boolean> {
  const limit = LIMITS[action].regular;
  const subject = createHash("sha256").update(`fogata:${ip}`).digest("hex").slice(0, 32);
  const [row] = await asAnon((tx) =>
    tx.execute<{ ok: boolean }>(sql`select public.take_rate_limit(${action}, ${subject}, ${limit.max}, ${limit.per}::interval) as ok`),
  );
  return row?.ok !== false;
}
