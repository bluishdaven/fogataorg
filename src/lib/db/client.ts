import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env.server";
import * as schema from "./schema";

/**
 * Connects as the database owner, which bypasses RLS. Application code must
 * not query `db` directly; use `withRls` (./rls.ts) so policies apply.
 */
const globalForDb = globalThis as unknown as { fogataSql?: postgres.Sql };

const client =
  globalForDb.fogataSql ??
  postgres(serverEnv.DATABASE_URL, {
    // Supabase's transaction pooler doesn't support prepared statements.
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.fogataSql = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
