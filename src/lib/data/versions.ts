import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth";
import { withRls, type RlsTransaction } from "@/lib/db/rls";
import { storyVersions } from "@/lib/db/schema";
import { countWords, tiptapToText, type TiptapDoc } from "@/lib/domain/content";

type Snapshot = { title: string; subtitle: string; content: TiptapDoc };

/**
 * Keeps the version history: while writing, one snapshot per ten minutes (the latest one is
 * updated until it's ten minutes old); every publish adds its own. Runs inside the save's
 * transaction, as the writer.
 */
export async function recordVersion(tx: RlsTransaction, storyId: string, snapshot: Snapshot, kind: "draft" | "published") {
  const values = { title: snapshot.title, subtitle: snapshot.subtitle, content: snapshot.content, wordCount: countWords(tiptapToText(snapshot.content)) };
  if (kind === "draft") {
    const updated = await tx
      .update(storyVersions)
      .set({ ...values, updatedAt: sql`now()` })
      .where(
        and(
          eq(storyVersions.id, sql`(select v.id from public.story_versions v where v.story_id = ${storyId} order by v.created_at desc limit 1)`),
          eq(storyVersions.kind, "draft"),
          sql`${storyVersions.createdAt} > now() - interval '10 minutes'`,
        ),
      )
      .returning({ id: storyVersions.id });
    if (updated.length) return;
  }
  await tx.insert(storyVersions).values({ storyId, kind, ...values });
}

export async function listVersions(viewer: Viewer, storyId: string) {
  return withRls(viewer.claims, (tx) =>
    tx
      .select({
        id: storyVersions.id,
        kind: storyVersions.kind,
        title: storyVersions.title,
        wordCount: storyVersions.wordCount,
        createdAt: storyVersions.createdAt,
        updatedAt: storyVersions.updatedAt,
      })
      .from(storyVersions)
      .where(eq(storyVersions.storyId, storyId))
      .orderBy(desc(storyVersions.createdAt)),
  );
}

export async function getVersion(viewer: Viewer, id: string) {
  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .select({ storyId: storyVersions.storyId, title: storyVersions.title, subtitle: storyVersions.subtitle, content: storyVersions.content })
      .from(storyVersions)
      .where(eq(storyVersions.id, id))
      .limit(1),
  );
  return row ?? null;
}
