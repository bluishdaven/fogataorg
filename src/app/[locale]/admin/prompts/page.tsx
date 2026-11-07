import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { listAdminPrompts } from "@/lib/data/prompts";
import { mondayOf } from "@/lib/domain/prompts";
import { PromptForm, PromptList } from "./prompt-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("promptsTitle"), robots: { index: false } };
}

export default async function PromptsAdminPage() {
  const t = await getTranslations("Admin");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <h1 className="font-serif text-4xl font-semibold">{t("promptsTitle")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground text-pretty">{t("promptsLede")}</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden />}>
        <Prompts />
      </Suspense>
    </div>
  );
}

async function Prompts() {
  const [viewer, locale] = await Promise.all([getViewer(), getLocale()]);
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/prompts`)}`);
  if (!viewer.isAdmin) notFound();
  const list = await listAdminPrompts(viewer);
  // getViewer() made this a request-time render, so reading the clock is fine here.
  const thisWeek = mondayOf(new Date());
  const taken = new Set(list.map((prompt) => prompt.weekOf));
  let suggested = thisWeek;
  while (taken.has(suggested)) suggested = mondayOf(new Date(Date.parse(`${suggested}T00:00:00Z`) + 7 * 86_400_000));
  return (
    <div className="flex flex-col gap-10">
      <PromptForm defaultWeek={suggested} />
      <PromptList prompts={list} thisWeek={thisWeek} />
    </div>
  );
}
