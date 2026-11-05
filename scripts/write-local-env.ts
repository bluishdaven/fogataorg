/**
 * Writes .env.local from the running local Supabase stack.
 * Usage: npm run setup:env   (after `npm run db:start`)
 * Keeps any lines you added that aren't managed here.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const status = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<string, string>;

const required = ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY", "DB_URL", "MAILPIT_URL"] as const;
for (const key of required) {
  if (!status[key]) throw new Error(`supabase status is missing ${key}. Is the stack running?`);
}

const managed: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL!,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY!,
  NEXT_PUBLIC_AUTH_GOOGLE_ENABLED: "false",
  SUPABASE_SECRET_KEY: status.SECRET_KEY!,
  DATABASE_URL: status.DB_URL!,
  MAILPIT_URL: status.MAILPIT_URL!,
};

const path = ".env.local";
const existing = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
const kept = existing.filter((line) => {
  const key = line.split("=")[0]?.trim();
  return line.trim() !== "" && !line.startsWith("# Managed by") && !(key && key in managed);
});

// Local secrets for email: generated once, then kept like any line you added.
for (const key of ["EMAIL_SIGNING_SECRET", "CRON_SECRET"]) {
  if (!kept.some((line) => line.split("=")[0]?.trim() === key)) {
    kept.push(`${key}=${randomBytes(32).toString("base64url")}`);
  }
}

const body = [
  "# Managed by scripts/write-local-env.ts (local Supabase). Safe to re-run.",
  ...Object.entries(managed).map(([key, value]) => `${key}=${value}`),
  ...(kept.length ? ["", ...kept] : []),
  "",
].join("\n");

writeFileSync(path, body);
console.log(`Wrote ${path} with ${Object.keys(managed).length} local values.`);
