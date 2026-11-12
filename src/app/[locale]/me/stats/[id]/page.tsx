import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { CountUp } from "@/components/stats/count-up";
import { DepthMeters } from "@/components/stats/depth-meters";
import { ReadsChart } from "@/components/stats/reads-chart";
import { StatTile } from "@/components/stats/stat-tile";
import { durationParts } from "@/components/stats/stats-format";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getStoryStats } from "@/lib/data/stats";
import { storyPath } from "@/lib/domain/handle-routes";
import { depthShares, readRatio, statsStoryIdSchema, totals } from "@/lib/domain/stats";

type Props = PageProps<"/[locale]/me/stats/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Stats");
  return { title: t("title"), robots: { index: false } };
}

export default async function StoryStatsPage({ params }: Props) {
  const t = await getTranslations("Stats");
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/me/stats" className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-ember-text">
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <StoryStats params={params} />
      </Suspense>
    </div>
  );
}

async function StoryStats({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/stats/${id}`)}`);
  if (!statsStoryIdSchema.safeParse(id).success) notFound();
  const [stats, t, format] = await Promise.all([getStoryStats(viewer, id), getTranslations("Stats"), getFormatter()]);
  if (!stats) notFound();

  const { story, totals: lifetime, depth, loved } = stats;
  const month = totals(stats.daily);
  const ratio = lifetime ? readRatio(lifetime.views, lifetime.reads) : null;
  const percent = (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const live = story.status === "published" || story.status === "unlisted";
  const href = storyPath(viewer.username, story.slug);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl" lang={story.language}>
          {story.title}
        </h1>
        <p className="text-muted-foreground">
          {story.publishedAt ? t("storyLede", { date: format.dateTime(story.publishedAt, { dateStyle: "long", timeZone: "UTC" }) }) : null}{" "}
          {live ? (
            <NextLink href={href} className="font-medium text-ember-text underline-offset-4 hover:underline">
              {t("viewStory")}
            </NextLink>
          ) : null}
        </p>
      </header>

      <section aria-labelledby="lifetime-title" className="flex flex-col gap-4">
        <h2 id="lifetime-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("lifetime")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="story-stats-tiles">
          <StatTile label={t("views")} index={0} testId="story-stat-views">
            <CountUp value={lifetime?.views ?? 0} formatted={format.number(lifetime?.views ?? 0)} />
          </StatTile>
          <StatTile label={t("reads")} hint={ratio === null ? undefined : t("ratioOf", { ratio: percent(ratio) })} index={1} testId="story-stat-reads">
            <CountUp value={lifetime?.reads ?? 0} formatted={format.number(lifetime?.reads ?? 0)} delay={80} />
          </StatTile>
          <StatTile label={t("avgTime")} index={2}>
            {lifetime && lifetime.reads > 0 ? t("duration", durationParts(lifetime.avgReadSeconds)) : "–"}
          </StatTile>
          <StatTile label={t("sparks")} hint={t("sparkers", { count: lifetime?.sparkers ?? 0 })} index={3}>
            <CountUp value={lifetime?.sparks ?? 0} formatted={format.number(lifetime?.sparks ?? 0)} delay={160} />
          </StatTile>
          <StatTile label={t("responses")} index={4}>
            <CountUp value={lifetime?.responses ?? 0} formatted={format.number(lifetime?.responses ?? 0)} delay={200} />
          </StatTile>
          <StatTile label={t("saves")} index={5}>
            <CountUp value={lifetime?.saves ?? 0} formatted={format.number(lifetime?.saves ?? 0)} delay={240} />
          </StatTile>
          <StatTile label={t("embers")} hint={t("embersHint")} index={6}>
            <CountUp value={lifetime?.emberReaders ?? 0} formatted={format.number(lifetime?.emberReaders ?? 0)} delay={280} />
          </StatTile>
        </div>
      </section>

      <section aria-labelledby="chart-title" className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
        <h2 id="chart-title" className="font-serif text-xl font-semibold">
          {t("chartTitle")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("periodTotals", { views: month.views, reads: month.reads })}
        </p>
        <ReadsChart days={stats.daily} testId="story-reads-chart" />
      </section>

      <section aria-labelledby="depth-title" className="flex flex-col gap-4">
        <div>
          <h2 id="depth-title" className="font-serif text-2xl font-semibold">
            {t("depthTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("depthLede", { count: depth.visitors })}</p>
        </div>
        {depth.visitors === 0 ? (
          <p className="text-muted-foreground">{t("depthEmpty")}</p>
        ) : (
          <DepthMeters
            rows={depthShares(depth).map((row) => ({
              key: row.key,
              label: t(`depth.${row.key}`),
              share: row.share,
              figure: `${percent(row.share)} · ${format.number(row.count)}`,
            }))}
          />
        )}
      </section>

      <section aria-labelledby="loved-title" className="flex flex-col gap-4">
        <div>
          <h2 id="loved-title" className="font-serif text-2xl font-semibold">
            {t("lovedTitle")}
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">{t("lovedLede")}</p>
        </div>
        {loved.length === 0 ? (
          <p className="text-muted-foreground">{t("lovedEmpty")}</p>
        ) : (
          <ol className="flex flex-col gap-4" data-testid="loved-passages">
            {loved.map((passage, index) => (
              <li
                key={passage.blockId}
                className="rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
                style={{ "--delay": `${index * 90}ms` } as CSSProperties}
              >
                <blockquote lang={story.language} className="border-l-4 border-ember pl-4 font-serif text-lg leading-relaxed text-pretty">
                  {passage.text.length > 420 ? `${passage.text.slice(0, 420).trimEnd()}…` : passage.text}
                </blockquote>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-ember-text">{t("lovedReaders", { count: passage.readers })}</span>
                  {live ? (
                    // A full page load, so the browser jumps to the paragraph and it glows.
                    <a href={`${href}#p-${passage.blockId}`} className="text-muted-foreground hover:text-ember-text">
                      {t("lovedLink")}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
