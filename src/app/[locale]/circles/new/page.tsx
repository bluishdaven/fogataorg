import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CircleForm } from "@/components/circles/circle-form";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Circles");
  return { title: t("start"), robots: { index: false } };
}

export default async function NewCirclePage() {
  const t = await getTranslations("Circles");
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Toaster position="bottom-center" />
      <h1 className="font-serif text-4xl font-semibold">{t("start")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("startLede")}</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/circles/new`)}`);
  return <CircleForm userId={viewer.id} />;
}
