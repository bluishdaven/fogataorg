try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides DATABASE_URL directly.
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Start Supabase and run `npm run setup:env`.");
}
