import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/domain/locale";
import { localeOfPath } from "@/lib/domain/onboarding";
import { safeNextPath } from "@/lib/domain/redirect";
import { afterSignInPath, saveSignUpLocale } from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** OAuth (Google) landing: exchanges the PKCE code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const wanted = searchParams.get("locale");
      const locale = isLocale(wanted) ? wanted : localeOfPath(next);
      if (data.user && locale) {
        await saveSignUpLocale({ id: data.user.id, email: data.user.email }, locale).catch((cause: unknown) =>
          console.error("[auth] saving the sign-up language failed", cause instanceof Error ? cause.message : cause),
        );
      }
      const destination = data.user ? await afterSignInPath(data.user.id, next) : next;
      return NextResponse.redirect(new URL(destination, origin));
    }
    console.error("[auth] exchangeCodeForSession failed", error.message);
  }

  const locale = LOCALES.find((l) => next === `/${l}` || next.startsWith(`/${l}/`)) ?? DEFAULT_LOCALE;
  return NextResponse.redirect(new URL(`/${locale}/login?error=oauth`, origin));
}
