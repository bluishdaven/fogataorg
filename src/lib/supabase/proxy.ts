import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

type CookieWrite = { name: string; value: string; options: Record<string, unknown> };

/**
 * Refreshes the Supabase session before anything renders. Refreshed cookies
 * are written onto the incoming request (so this render sees the new session)
 * and returned as `apply`, which copies them, plus Supabase's no-store cache
 * headers, onto whatever response the proxy ends up returning.
 */
export async function refreshSession(
  request: NextRequest,
): Promise<<T extends NextResponse>(response: T) => T> {
  let writes: CookieWrite[] = [];
  let headers: Record<string, string> = {};

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          writes = cookiesToSet;
          headers = cacheHeaders ?? {};
        },
      },
    },
  );

  // Verifies the JWT and refreshes it when expired. Don't run code between
  // client creation and this call; it can cause random sign-outs.
  await supabase.auth.getClaims();

  return (response) => {
    for (const { name, value, options } of writes) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  };
}
