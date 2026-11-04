import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  // Direct or pooled Postgres URL. On Vercel use Supabase's transaction pooler (port 6543).
  DATABASE_URL: z.string().min(1),
});

export const serverEnv = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});
