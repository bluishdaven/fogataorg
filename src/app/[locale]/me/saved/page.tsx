import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { getViewer } from "@/lib/auth";
import { listSaved } from "@/lib/data/social";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  return { title: t("savedTitle"), robots: { index: false } };
}

export default async function SavedPage() {
  const t = await getTranslations("Social");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t("savedTitle")}</h1>
      <p className="mt-2 mb-6 text-muted-foreground">{t("savedLede")}</p>
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <Saved />
      </Suspense>
    </div>
  );
}

async function Saved() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/saved`)}`);
  const [items, t] = await Promise.all([listSaved(viewer), getTranslations("Social")]);
  if (!items.length) return <p className="text-muted-foreground">{t("savedEmpty")}</p>;
  return (
    <div data-testid="saved-list">
      {items.map((story) => (
        <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
      ))}
    </div>
  );
}
