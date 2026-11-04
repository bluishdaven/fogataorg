import "server-only";
import { db } from "./client";
import { applyRlsContext, type RlsClaims, type RlsTransaction } from "./rls-context";

export type { RlsClaims, RlsTransaction } from "./rls-context";

/**
 * Runs `fn` in a transaction as Supabase's `anon` (claims = null) or
 * `authenticated` role, with JWT claims set so `auth.uid()` works inside
 * policies. This is the only way app code should touch the database.
 */
export function withRls<T>(claims: RlsClaims, fn: (tx: RlsTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await applyRlsContext(tx, claims);
    return fn(tx);
  });
}

/** Read public data as an anonymous visitor. Safe inside `'use cache'`. */
export function asAnon<T>(fn: (tx: RlsTransaction) => Promise<T>): Promise<T> {
  return withRls(null, fn);
}
