import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. CI): rely on the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  // Generated SQL lands where the Supabase CLI applies it (supabase db reset / db push).
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
  schemaFilter: ["public"],
  // Supabase owns anon/authenticated/service_role; don't try to create them.
  entities: { roles: { provider: "supabase" } },
  strict: true,
  verbose: true,
});
