import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/domain/locale";
import { safeNextPath } from "@/lib/domain/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const otpType = z.enum([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]) satisfies z.ZodType<EmailOtpType>;

function loginErrorUrl(next: string, origin: string): URL {
  const locale = LOCALES.find((l) => next === `/${l}` || next.startsWith(`/${l}/`)) ?? DEFAULT_LOCALE;
  return new URL(`/${locale}/login?error=link&next=${encodeURIComponent(next)}`, origin);
}

/** Landing page for magic links and sign-up confirmations (token-hash flow). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/");
  const tokenHash = searchParams.get("token_hash");
  const type = otpType.safeParse(searchParams.get("type"));

  if (tokenHash && type.success) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth] verifyOtp failed", error.message);
  }

  return NextResponse.redirect(loginErrorUrl(next, origin));
}
