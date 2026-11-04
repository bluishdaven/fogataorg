import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type * as schema from "./schema";

export type RlsTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Verified JWT claims of the signed-in user, or null for anonymous visitors. */
export type RlsClaims = {
  sub: string;
  email?: string;
  [claim: string]: unknown;
} | null;

/**
 * Switches the current transaction to the role and claims PostgREST would use,
 * so `auth.uid()` and `auth.jwt()` behave the same as through the Data API.
 * `set_config(..., true)` scopes everything to the transaction.
 */
export async function applyRlsContext(
  tx: Pick<RlsTransaction, "execute">,
  claims: RlsClaims,
): Promise<void> {
  const role = claims ? "authenticated" : "anon";
  const jwt = JSON.stringify(claims ? { ...claims, role } : { role });
  await tx.execute(sql`
    select
      set_config('request.jwt.claims', ${jwt}, true),
      set_config('request.jwt.claim.sub', ${claims?.sub ?? ""}, true),
      set_config('role', ${role}, true)
  `);
}
