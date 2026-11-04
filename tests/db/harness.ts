import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { applyRlsContext, type RlsClaims, type RlsTransaction } from "@/lib/db/rls-context";

/**
 * RLS test harness. Every scenario runs inside one transaction that is rolled
 * back at the end, so tests never leave data behind and can run against a
 * seeded database. `as()` switches role in a savepoint, exactly like the app's
 * withRls(), then switches back to the owner for setup and assertions.
 */

const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
export const db = drizzle(client, { schema });

class Rollback extends Error {}

export type Harness = {
  tx: RlsTransaction;
  createUser(input?: { email?: string; metadata?: Record<string, unknown> }): Promise<string>;
  as<T>(claims: RlsClaims, fn: (tx: RlsTransaction) => Promise<T>): Promise<T>;
  /** Runs as the owner in a savepoint, so an expected error doesn't abort the scenario. */
  savepoint<T>(fn: (tx: RlsTransaction) => Promise<T>): Promise<T>;
  claimsFor(userId: string): NonNullable<RlsClaims>;
};

export async function scenario(fn: (h: Harness) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const harness: Harness = {
        tx,
        async createUser(input = {}) {
          const id = randomUUID();
          const email = input.email ?? `rls-${id.slice(0, 8)}@fogata.test`;
          await tx.execute(sql`
            insert into auth.users
              (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at, created_at, updated_at)
            values
              ('00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated', ${email},
               ${JSON.stringify(input.metadata ?? {})}::jsonb, '{}'::jsonb, now(), now(), now())
          `);
          return id;
        },
        async as(claims, inner) {
          try {
            return await tx.transaction(async (sp) => {
              await applyRlsContext(sp, claims);
              return inner(sp);
            });
          } finally {
            await tx.execute(sql`reset role`);
            await tx.execute(
              sql`select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)`,
            );
          }
        },
        savepoint(inner) {
          return tx.transaction(inner);
        },
        claimsFor(userId) {
          return { sub: userId, email: `${userId}@fogata.test` };
        },
      };
      await fn(harness);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** Postgres error code from a driver error, possibly wrapped by Drizzle. */
export function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current && "code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = typeof current === "object" && current && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export async function expectPgError(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const actual = pgCode(error);
    if (actual !== code) {
      throw new Error(`Expected Postgres error ${code}, got ${actual ?? "unknown"}: ${String(error)}`);
    }
    return;
  }
  throw new Error(`Expected Postgres error ${code}, but the query succeeded`);
}

export const PG = {
  insufficientPrivilege: "42501",
  checkViolation: "23514",
  uniqueViolation: "23505",
} as const;

export async function closeDb() {
  await client.end();
}
