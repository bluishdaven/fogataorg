import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { profiles } from "@/lib/db/schema";
import { withRls, type RlsClaims } from "@/lib/db/rls";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  claims: NonNullable<RlsClaims>;
  username: string;
  displayName: string;
};

/**
 * The signed-in reader, verified from the session JWT, or null. Reads cookies,
 * so call it only inside a <Suspense> boundary, Server Action or Route Handler.
 * Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const claims = { ...data.claims, sub: data.claims.sub } as NonNullable<RlsClaims>;
  const profile = await withRls(claims, (tx) =>
    tx
      .select({ username: profiles.username, displayName: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, claims.sub))
      .limit(1),
  );
  const row = profile[0];
  if (!row) return null;

  return {
    id: claims.sub,
    claims,
    username: row.username,
    displayName: row.displayName || row.username,
  };
});
