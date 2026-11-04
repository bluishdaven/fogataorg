import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FlameLogo } from "@/components/flame-logo";
import { publicEnv } from "@/lib/env";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations("Auth");
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:py-24">
      <div className="flex flex-col items-center gap-3 text-center">
        <FlameLogo className="h-12" />
        <h1 className="font-serif text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/login">["searchParams"];
}) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const error = typeof params.error === "string" ? params.error : undefined;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <LoginForm
      locale={locale}
      next={next}
      linkError={error === "link" || error === "oauth"}
      googleEnabled={publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED}
    />
  );
}
