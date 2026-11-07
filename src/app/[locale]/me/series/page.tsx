import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { listMySeries } from "@/lib/data/series";
import { SeriesManager } from "./series-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Series");
  return { title: t("manageTitle"), robots: { index: false } };
}

export default async function MySeriesPage() {
  const t = await getTranslations("Series");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <h1 className="font-serif text-4xl font-semibold">{t("manageTitle")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground text-pretty">{t("manageLede")}</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Manager />
      </Suspense>
    </div>
  );
}

async function Manager() {
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/series`)}`);
  const data = await listMySeries(viewer);
  return <SeriesManager username={viewer.username} data={data} />;
}
