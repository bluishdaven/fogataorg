import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { listPastPrompts } from "@/lib/data/prompts";
import { promptText } from "@/lib/domain/prompts";
import { localeAlternates } from "@/lib/domain/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Spark"), getLocale()]);
  return { title: t("archiveTitle"), description: t("archiveLede"), alternates: localeAlternates(locale, "/prompts") };
}

export default async function PromptsPage() {
  const t = await getTranslations("Spark");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t("archiveTitle")}</h1>
      <p className="mt-2 mb-8 text-lg text-muted-foreground text-pretty">{t("archiveLede")}</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Archive />
      </Suspense>
    </div>
  );
}

async function Archive() {
  const [list, t, locale] = await Promise.all([listPastPrompts(), getTranslations("Spark"), getLocale()]);
  if (!list.length) return <p className="text-muted-foreground">{t("archiveEmpty")}</p>;
  return (
    <ul className="divide-y divide-border" data-testid="prompt-archive">
      {list.map((prompt) => (
        <li key={prompt.id} className="py-4">
          <Link href={`/prompts/${prompt.weekOf}`} className="group flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{t("weekOf", { date: new Date(`${prompt.weekOf}T00:00:00Z`) })}</span>
            <span className="font-serif text-xl group-hover:text-ember-text">{promptText(prompt, locale)}</span>
            <span className="text-sm text-ember-text">{t("entries", { count: prompt.entries })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
