import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Import");
  return { title: t("title"), robots: { index: false } };
}

export default async function ImportPage() {
  const t = await getTranslations("Import");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-lg text-muted-foreground text-pretty">{t("lede")}</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <SignedInWizard />
      </Suspense>
    </div>
  );
}

async function SignedInWizard() {
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/write/import`)}`);
  return <ImportWizard locale={locale === "es" ? "es" : "en"} />;
}
