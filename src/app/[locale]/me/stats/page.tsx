import { ChartNoAxesColumn } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CountUp } from "@/components/stats/count-up";
import { ReadsChart } from "@/components/stats/reads-chart";
import { StatTile } from "@/components/stats/stat-tile";
import type { Delta } from "@/components/stats/stat-tile";
import { deltaParts, durationParts } from "@/components/stats/stats-format";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getWriterOverview } from "@/lib/data/stats";
import { averageSeconds, readRatio, splitPeriods, STATS_PERIOD_DAYS, totals } from "@/lib/domain/stats";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Stats");
  return { title: t("title"), robots: { index: false } };
}

export default async function StatsPage() {
  const t = await getTranslations("Stats");
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 max-w-prose text-muted-foreground text-pretty">{t("lede")}</p>
      <Suspense fallback={<StatsSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

async function Overview() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/stats`)}`);
  const [overview, t, format] = await Promise.all([getWriterOverview(viewer), getTranslations("Stats"), getFormatter()]);
  const { current, previous } = splitPeriods(overview.daily, STATS_PERIOD_DAYS);
  const now = totals(current);
  const before = totals(previous);
  const ratio = readRatio(now.views, now.reads);
  const ratioBefore = readRatio(before.views, before.reads);
  const avg = averageSeconds(now.readSeconds, now.reads);
  const avgBefore = averageSeconds(before.readSeconds, before.reads);
  const comparison = t("vsPrevious");
  const delta = (current: number, earlier: number): Delta => {
    const parts = deltaParts(format, current, earlier);
    if (!parts) return null;
    return { direction: parts.direction, text: parts.direction === "flat" ? t("flat") : t(parts.direction, { value: parts.value }) };
  };
  const percent = (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="period-title" className="flex flex-col gap-4">
        <h2 id="period-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("period")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="stats-tiles">
          <StatTile label={t("views")} delta={delta(now.views, before.views)} comparison={comparison} index={0} testId="stat-views">
            <CountUp value={now.views} formatted={format.number(now.views)} />
          </StatTile>
          <StatTile label={t("reads")} delta={delta(now.reads, before.reads)} comparison={comparison} index={1} testId="stat-reads">
            <CountUp value={now.reads} formatted={format.number(now.reads)} delay={80} />
          </StatTile>
          <StatTile
            label={t("readRatio")}
            hint={t("readRatioHint")}
            delta={ratio !== null && ratioBefore !== null ? delta(ratio, ratioBefore) : null}
            index={2}
            testId="stat-ratio"
          >
            {ratio === null ? "–" : (
              <>
                <CountUp value={Math.round(ratio * 100)} formatted={percent(ratio)} delay={160} />
                <span aria-hidden>%</span>
              </>
            )}
          </StatTile>
          <StatTile
            label={t("avgTime")}
            delta={avg !== null && avgBefore !== null ? delta(avg, avgBefore) : null}
            index={3}
            testId="stat-time"
          >
            {avg === null ? "–" : t("duration", durationParts(avg))}
          </StatTile>
          <StatTile
            label={t("newFollowers")}
            delta={delta(overview.followers.current, overview.followers.previous)}
            comparison={t("followersTotal", { count: overview.followers.total })}
            index={4}
            testId="stat-followers"
          >
            <CountUp value={overview.followers.current} formatted={format.number(overview.followers.current)} delay={240} />
          </StatTile>
        </div>
      </section>

      <section aria-labelledby="chart-title" className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <h2 id="chart-title" className="mb-4 font-serif text-xl font-semibold">
          {t("chartTitle")}
        </h2>
        {now.views === 0 ? <p className="mb-4 text-sm text-muted-foreground">{t("emptyPeriod")}</p> : null}
        <ReadsChart days={current} />
      </section>

      <section aria-labelledby="stories-title" className="flex flex-col gap-3">
        <div>
          <h2 id="stories-title" className="font-serif text-2xl font-semibold">
            {t("storiesTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("storiesLede")}</p>
        </div>
        {overview.stories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">{t("noStories")}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border" data-testid="stats-stories">
            {overview.stories.map((story) => {
              const storyRatio = readRatio(story.views, story.reads);
              const cells = [
                { key: "views", label: t("views"), value: format.number(story.views) },
                { key: "reads", label: t("reads"), value: format.number(story.reads) },
                { key: "ratio", label: t("readRatio"), value: storyRatio === null ? "–" : percent(storyRatio) },
                { key: "sparks", label: t("sparks"), value: format.number(story.sparks) },
                { key: "responses", label: t("responses"), value: format.number(story.responses) },
                { key: "saves", label: t("saves"), value: format.number(story.saves) },
              ];
              return (
                <li key={story.storyId} className="flex flex-col gap-3 py-4" data-testid="stats-story">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/me/stats/${story.storyId}`}
                      className="font-serif text-lg font-semibold text-pretty hover:text-ember-text"
                      lang={story.language}
                    >
                      {story.title}
                    </Link>
                    <ChartNoAxesColumn className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
                    {cells.map((cell) => (
                      <div key={cell.key} className="flex flex-col">
                        <dt className="text-xs text-muted-foreground">{cell.label}</dt>
                        <dd className="tabular-nums">{cell.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
