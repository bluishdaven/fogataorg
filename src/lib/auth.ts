import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { profiles } from "@/lib/db/schema";
import { donorActiveSql, foundingNumberSql, publishedCountSql } from "@/lib/data/badge-sql";
import { withRls, type RlsClaims } from "@/lib/db/rls";
import { badgeData, isAdminClaims, type BadgeData } from "@/lib/domain/badges";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  claims: NonNullable<RlsClaims>;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  pronouns: string;
  /** When the account was created (new accounts get tighter rate limits). */
  createdAt: Date;
  badges: BadgeData;
  /** Owner account (Supabase app_metadata.role = "admin"); can grant donor badges. */
  isAdmin: boolean;
};

/**
 * The signed-in reader, verified from the session JWT, or null. Reads cookies,
 * so call it only inside a <Suspense> boundary, Server Action or Route Handler.
 * Deduplicated per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Session checks compare token expiry with the clock, so they must run per request,
  // never in a (runtime) prerender. Without this, partial prefetching trips on Date.now().
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const claims = { ...data.claims, sub: data.claims.sub } as NonNullable<RlsClaims>;
  const profile = await withRls(claims, (tx) =>
    tx
      .select({
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        pronouns: profiles.pronouns,
        createdAt: profiles.createdAt,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
        foundingNumber: foundingNumberSql(),
      })
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
    avatarUrl: row.avatarUrl,
    pronouns: row.pronouns,
    createdAt: row.createdAt,
    badges: badgeData(row),
    isAdmin: isAdminClaims(claims),
  };
});
