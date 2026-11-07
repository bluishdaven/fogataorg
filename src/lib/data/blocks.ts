import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles, userBlocks } from "@/lib/db/schema";
import type { BlockKind } from "@/lib/domain/social";

/** Whether the reader muted or blocked this person (their own rows only, by RLS). */
export async function getBlockState(viewer: Viewer, userId: string): Promise<BlockKind | null> {
  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .select({ kind: userBlocks.kind })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, viewer.id), eq(userBlocks.blockedId, userId))),
  );
  return row?.kind ?? null;
}

/** Everyone the reader muted or blocked: their stories and responses stay out of sight. */
export async function hiddenPeople(viewer: Viewer | null): Promise<Set<string>> {
  if (!viewer) return new Set();
  const rows = await withRls(viewer.claims, (tx) =>
    tx.select({ id: userBlocks.blockedId }).from(userBlocks).where(eq(userBlocks.blockerId, viewer.id)),
  );
  return new Set(rows.map((row) => row.id));
}

/** For Settings: the people the reader muted or blocked, oldest first. */
export async function listBlocked(viewer: Viewer) {
  return withRls(viewer.claims, (tx) =>
    tx
      .select({ userId: userBlocks.blockedId, kind: userBlocks.kind, username: profiles.username, displayName: profiles.displayName })
      .from(userBlocks)
      .innerJoin(profiles, eq(profiles.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, viewer.id))
      .orderBy(asc(userBlocks.createdAt)),
  );
}
