import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { UserBadges } from "@/components/badges/user-badges";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { getSeriesPage } from "@/lib/data/series";
import { profilePath, seriesPath } from "@/lib/domain/handle-routes";

type Props = PageProps<"/[locale]/u/[handle]/series/[series]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, series } = await params;
  const data = await getSeriesPage(handle, series);
  if (!data) return {};
  const t = await getTranslations("Series");
  const name = data.author.displayName || data.author.username;
  return {
    title: data.title,
    description: data.description || t("by", { name }),
    alternates: { canonical: seriesPath(data.author.username, data.slug) },
    robots: data.parts.length ? undefined : { index: false, follow: true },
    openGraph: { siteName: "Fogata", title: data.title, description: data.description || t("by", { name }) },
  };
}

export default function SeriesPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <SeriesContent params={params} />
      </Suspense>
    </div>
  );
}

async function SeriesContent({ params }: Pick<Props, "params">) {
  const { handle, series } = await params;
  const [data, t] = await Promise.all([getSeriesPage(handle, series), getTranslations("Series")]);
  if (!data) notFound();
  const name = data.author.displayName || data.author.username;

  return (
    <>
      <header className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-ember-text uppercase">{t("navLabel")}</p>
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance sm:text-title">{data.title}</h1>
        {data.description ? <p className="font-serif text-xl text-muted-foreground text-pretty">{data.description}</p> : null}
        <div className="flex items-center gap-3">
          <NextLink href={profilePath(data.author.username)} tabIndex={-1} aria-hidden>
            <Avatar name={name} url={data.author.avatarUrl} className="size-10 text-sm" />
          </NextLink>
          <p className="text-sm">
            <span className="flex flex-wrap items-center gap-1.5">
              <NextLink href={profilePath(data.author.username)} className="font-medium hover:text-ember-text">
                {name}
              </NextLink>
              <UserBadges badges={data.author.badges} />
            </span>
            <span className="text-muted-foreground">{t("parts", { count: data.parts.length })}</span>
          </p>
        </div>
      </header>
      {data.parts.length ? (
        <ol data-testid="series-page-parts">
          {data.parts.map((story, index) => (
            <li key={story.slug}>
              <h2 className="pt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("partLabel", { position: index + 1 })}</h2>
              <StoryCard story={story} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </>
  );
}
