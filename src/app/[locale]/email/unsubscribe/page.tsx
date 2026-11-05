import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/lib/domain/locale";
import { userIdFromUnsubscribeToken } from "@/lib/email/preferences";
import { UnsubscribeForm } from "./unsubscribe-form";

type Props = PageProps<"/[locale]/email/unsubscribe">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Unsubscribe");
  return { title: t("title"), robots: { index: false } };
}

export default function UnsubscribePage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: Pick<Props, "searchParams">) {
  const [{ token }, t, locale] = await Promise.all([searchParams, getTranslations("Unsubscribe"), getLocale()]);
  const valid = typeof token === "string" && userIdFromUnsubscribeToken(token) !== null;

  if (!valid || !isLocale(locale)) {
    return (
      <>
        <h1 className="font-serif text-4xl font-semibold">{t("invalidTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("invalid")}</p>
        <Link href="/settings/notifications" className="mt-6 inline-block font-medium text-ember-text underline underline-offset-2">
          {t("settings")}
        </Link>
      </>
    );
  }
  return <UnsubscribeForm token={token} locale={locale} />;
}
