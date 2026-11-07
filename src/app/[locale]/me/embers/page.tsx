import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { listMyEmbers } from "@/lib/data/highlights";
import { storyPath } from "@/lib/domain/handle-routes";
import { passageUrl } from "@/lib/domain/highlights";
import { RemoveEmberButton } from "./remove-ember-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Embers");
  return { title: t("title"), robots: { index: false } };
}

export default async function EmbersPage() {
  const t = await getTranslations("Embers");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("lede")}</p>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Embers />
      </Suspense>
    </div>
  );
}

async function Embers() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/embers`)}`);
  const [embers, t] = await Promise.all([listMyEmbers(viewer), getTranslations("Embers")]);
  if (!embers.length) return <p className="text-muted-foreground">{t("empty")}</p>;
  return (
    <ul className="flex flex-col gap-6" data-testid="embers-list">
      {embers.map((ember) => {
        const author = ember.authorDisplayName || ember.authorUsername;
        return (
          <li key={ember.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <blockquote lang={ember.language} className="border-l-4 border-ember pl-4 font-serif text-lg leading-relaxed text-pretty">
              {ember.quote}
            </blockquote>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {/* A full page load, so the browser jumps to the passage and marks the words. */}
              <a
                href={passageUrl(storyPath(ember.authorUsername, ember.slug), ember.blockId, ember.quote)}
                className="text-muted-foreground hover:text-ember-text"
              >
                {t("from", { title: ember.title, author })}
              </a>
              <RemoveEmberButton id={ember.id} title={ember.title} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
