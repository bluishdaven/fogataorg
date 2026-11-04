import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/domain/locale";
import { safeNextPath } from "@/lib/domain/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** OAuth (Google) landing: exchanges the PKCE code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth] exchangeCodeForSession failed", error.message);
  }

  const locale = LOCALES.find((l) => next === `/${l}` || next.startsWith(`/${l}/`)) ?? DEFAULT_LOCALE;
  return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, origin));
}
