import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/** Browser Supabase client (uses the signed-in reader's session cookie). */
export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
