"use server";

import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, isLoopback } from "@/lib/domain/limits";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/domain/locale";
import { safeNextPath } from "@/lib/domain/redirect";
import { magicLinkSchema, oauthSchema } from "@/lib/domain/schemas";
import { publicEnv } from "@/lib/env";
import { allowAnonymous } from "@/lib/limits";
import { googleSignInEnabled } from "@/lib/runtime-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; field?: "email"; email?: string };

function localeFrom(formData: FormData): Locale {
  const value = formData.get("locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Origin the reader is on, so links in emails and OAuth redirects return to the
 * same deployment (localhost, preview, production). Supabase still checks the
 * result against its redirect allowlist.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return publicEnv.NEXT_PUBLIC_SITE_URL;
}

export async function sendMagicLink(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "Validation" });

  const parsed = magicLinkSchema.safeParse({
    email: formData.get("email"),
    locale,
    next: formData.get("next") || undefined,
  });
  const submittedEmail = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) {
    return { status: "error", message: t("email"), field: "email", email: submittedEmail };
  }

  // Bots: a person check (when Turnstile is configured), then a per-IP limit on sign-in links.
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders.get("x-forwarded-for"), requestHeaders.get("x-real-ip"));
  const tAuth = await getTranslations({ locale, namespace: "Auth" });
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? "") || null, ip))) {
    return { status: "error", message: tAuth("botCheckFailed"), email: submittedEmail };
  }
  if (ip && !isLoopback(ip) && !(await allowAnonymous("signInLink", ip))) {
    return { status: "error", message: tAuth("rateLimited"), email: submittedEmail };
  }

  const next = safeNextPath(parsed.data.next, `/${locale}`);
  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
      // Saved on the new user; the email template and profile use it.
      data: { locale },
    },
  });

  if (error) {
    if (error.status === 429) {
      return { status: "error", message: tAuth("rateLimited"), email: submittedEmail };
    }
    console.error("[auth] signInWithOtp failed", error.message);
    return { status: "error", message: t("generic"), email: submittedEmail };
  }

  return { status: "sent", email: parsed.data.email };
}

export async function signInWithOAuth(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const parsed = oauthSchema.safeParse({
    provider: formData.get("provider"),
    locale,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success || !googleSignInEnabled()) {
    redirect(`/${locale}/login`);
  }

  const next = safeNextPath(parsed.data.next, `/${locale}`);
  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    console.error("[auth] signInWithOAuth failed", error?.message);
    redirect(`/${locale}/login?error=oauth`);
  }
  redirect(data.url);
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
