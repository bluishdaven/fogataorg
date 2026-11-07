import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { getStorySeries } from "@/lib/data/series";
import { seriesPath, storyPath } from "@/lib/domain/handle-routes";
import { seriesNav } from "@/lib/domain/series";

/**
 * "Part 2 of 5 in The River", with the previous and next parts: a box under the story's header,
 * and a "Next in …" link after the story. Renders nothing for stories outside a series.
 */
export async function StorySeriesNav({
  seriesId,
  handle,
  slug,
  placement,
  locale,
}: {
  seriesId: string | null;
  handle: string;
  slug: string;
  placement: "top" | "bottom";
  locale: string;
}) {
  if (!seriesId) return null;
  const series = await getStorySeries(seriesId);
  const nav = series ? seriesNav(series.parts, slug) : null;
  if (!series || !nav || nav.total < 2) return null;
  const t = await getTranslations("Series");

  if (placement === "bottom") {
    return nav.next ? (
      <p className="mx-auto mt-10 max-w-[var(--measure)]" lang={locale} data-testid="story-series-next">
        <NextLink href={storyPath(handle, nav.next.slug)} className="group flex flex-col rounded-xl border border-border/70 bg-card p-4 hover:border-ember">
          <span className="text-sm text-muted-foreground">{t("nextUp", { title: series.title })}</span>
          <span className="font-serif text-lg font-semibold group-hover:text-ember-text">{nav.next.title} →</span>
        </NextLink>
      </p>
    ) : null;
  }

  return (
    <nav aria-label={t("navLabel")} className="mx-auto mb-8 max-w-[var(--measure)] rounded-xl border border-border/70 bg-card p-4 text-sm" lang={locale} data-testid="story-series">
      <p>
        {t.rich("partOf", {
          position: nav.position,
          total: nav.total,
          title: series.title,
          series: (chunks) => (
            <NextLink href={seriesPath(handle, series.slug)} className="font-medium text-ember-text underline underline-offset-4">
              {chunks}
            </NextLink>
          ),
        })}
      </p>
      {nav.previous || nav.next ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {nav.previous ? (
            <NextLink href={storyPath(handle, nav.previous.slug)} rel="prev" className="flex flex-col hover:text-ember-text">
              <span className="text-xs text-muted-foreground">← {t("previous")}</span>
              <span className="line-clamp-2 font-medium">{nav.previous.title}</span>
            </NextLink>
          ) : (
            <span />
          )}
          {nav.next ? (
            <NextLink href={storyPath(handle, nav.next.slug)} rel="next" className="flex flex-col text-right hover:text-ember-text">
              <span className="text-xs text-muted-foreground">{t("next")} →</span>
              <span className="line-clamp-2 font-medium">{nav.next.title}</span>
            </NextLink>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
