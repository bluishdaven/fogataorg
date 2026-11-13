import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { OfflineSync } from "@/components/app/offline-sync";
import { ReadingListTools } from "@/components/social/reading-list-tools";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { listReadingLists, listSaved } from "@/lib/data/social";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/me/saved">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  return { title: t("savedTitle"), robots: { index: false } };
}

export default async function SavedPage({ searchParams }: Props) {
  const t = await getTranslations("Social");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t("savedTitle")}</h1>
      <p className="mt-2 mb-6 text-muted-foreground">{t("savedLede")}</p>
      <OfflineSync />
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <Saved searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const listParam = z.uuid().catch("");

async function Saved({ searchParams }: Pick<Props, "searchParams">) {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/saved`)}`);
  const [params, { savedCount, lists }, t] = await Promise.all([searchParams, listReadingLists(viewer), getTranslations("Social")]);
  const wanted = listParam.parse(params.list);
  // An unknown or someone else's list shows Saved.
  const current = lists.find((list) => list.id === wanted) ?? null;
  const items = await listSaved(viewer, current?.id ?? null);
  const chips = [{ id: null, name: t("savedTitle"), count: savedCount }, ...lists];

  return (
    <>
      {lists.length ? (
        <nav aria-label={t("listsNav")} className="mb-6">
          <ul className="flex flex-wrap gap-2" data-testid="reading-lists">
            {chips.map((chip) => {
              const active = chip.id === (current?.id ?? null);
              return (
                <li key={chip.id ?? "saved"}>
                  <Link
                    href={{ pathname: "/me/saved", query: chip.id ? { list: chip.id } : {} }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors sm:min-h-8",
                      active ? "border-ember bg-ember-soft text-ember-text" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="max-w-48 truncate">{chip.name}</span>
                    <span className={cn("tabular-nums", !active && "text-muted-foreground")}>{chip.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {current ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold" data-testid="reading-list-name">
            {current.name}
          </h2>
          <ReadingListTools id={current.id} name={current.name} />
        </div>
      ) : null}

      {items.length ? (
        <div data-testid="saved-list">
          {items.map((story) => (
            <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">{current ? t("listEmpty") : t("savedEmpty")}</p>
      )}
    </>
  );
}
