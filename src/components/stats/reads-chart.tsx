"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { niceCeiling } from "@/lib/domain/stats";
import { cn } from "@/lib/utils";

export type ChartDay = { day: string; views: number; reads: number };

/**
 * Visits per day as columns, the reads (visits past half the story) as the darker lower part of
 * each. Hover or focus a day for its numbers (arrow keys move between days); the same numbers are
 * in the table under it. Columns rise in on load (motion-safe, see `.chart-column`).
 */
export function ReadsChart({ days, testId = "reads-chart" }: { days: ChartDay[]; testId?: string }) {
  const t = useTranslations("Stats");
  const format = useFormatter();
  const [active, setActive] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const descriptionId = useId();
  const plot = useRef<HTMLDivElement>(null);

  const max = niceCeiling(Math.max(0, ...days.map((day) => day.views)));
  const date = (day: string, style: "short" | "long" = "short") =>
    format.dateTime(new Date(`${day}T00:00:00Z`), style === "short" ? { month: "short", day: "numeric", timeZone: "UTC" } : { dateStyle: "medium", timeZone: "UTC" });
  const describe = (index: number) => {
    const day = days[index];
    if (!day) return "";
    return `${date(day.day, "long")}: ${t("tooltipVisits", { count: day.views })}, ${t("tooltipReads", { count: day.reads })}`;
  };

  const move = (index: number) => {
    const next = Math.max(0, Math.min(days.length - 1, index));
    setActive(next);
    setAnnouncement(describe(next));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? days.length - 1;
    const keys: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: days.length - 1 };
    if (event.key in keys) {
      event.preventDefault();
      move(keys[event.key]!);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const shown = active === null ? null : days[active];
  const ticks = [max, max / 2, 0];
  const labelDays = days.length ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [];

  return (
    <figure className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-chart-visits" />
          {t("legendVisits")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-chart-reads" />
          {t("legendReads")}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        {/* Y axis: round ticks, recessive. */}
        <div className="relative h-48 w-8 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((tick, index) => (
            <span key={index} className="absolute right-0 -translate-y-1/2" style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}>
              {format.number(tick)}
            </span>
          ))}
        </div>
        <div
          ref={plot}
          className="relative h-48 rounded-sm"
          role="group"
          tabIndex={0}
          aria-label={t("chartTitle")}
          aria-describedby={descriptionId}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (active === null) move(days.length - 1);
          }}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          data-testid={`${testId}-plot`}
        >
          {ticks.map((_, index) => (
            <span
              key={index}
              aria-hidden
              className="absolute inset-x-0 h-px bg-border"
              style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {days.map((day, index) => {
              const others = Math.max(0, day.views - day.reads);
              const readsHeight = (day.reads / max) * 100;
              const othersHeight = (others / max) * 100;
              return (
                <div
                  key={day.day}
                  className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                  onPointerEnter={() => setActive(index)}
                  aria-hidden
                  data-active={active === index ? "true" : undefined}
                >
                  <div
                    className={cn(
                      "chart-column flex h-full w-full max-w-6 flex-col-reverse transition-opacity duration-150",
                      active !== null && active !== index && "opacity-50",
                    )}
                    style={{ "--i": index } as CSSProperties}
                  >
                    {day.reads > 0 ? (
                      <span
                        className={cn("block w-full bg-chart-reads", others === 0 && "rounded-t-[4px]")}
                        style={{ height: `${readsHeight}%` }}
                      />
                    ) : null}
                    {others > 0 ? (
                      <span
                        className={cn("block w-full rounded-t-[4px] bg-chart-visits", day.reads > 0 && "mb-[2px]")}
                        style={{ height: `calc(${othersHeight}% - ${day.reads > 0 ? 2 : 0}px)` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {shown && active !== null ? (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-2 z-10 w-max -translate-y-full rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg",
                active < days.length * 0.25 ? "translate-x-0" : active > days.length * 0.75 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
              data-testid={`${testId}-tooltip`}
            >
              <p className="text-xs text-muted-foreground">{date(shown.day, "long")}</p>
              <p className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-visits" />
                <span className="font-semibold">{format.number(shown.views)}</span>
                <span className="text-muted-foreground">{t("legendVisits")}</span>
              </p>
              <p className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-reads" />
                <span className="font-semibold">{format.number(shown.reads)}</span>
                <span className="text-muted-foreground">{t("legendReads")}</span>
              </p>
            </div>
          ) : null}
        </div>
        <span />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground" aria-hidden>
          {labelDays.map((index) => (
            <span key={index}>{date(days[index]!.day)}</span>
          ))}
        </div>
      </div>

      <figcaption id={descriptionId} className="text-sm text-muted-foreground">
        {t("chartCaption")} <span className="sr-only">{t("chartKeys")}</span>
      </figcaption>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <details className="text-sm">
        <summary className="w-fit cursor-pointer font-medium text-ember-text underline-offset-4 hover:underline">{t("showTable")}</summary>
        <table className="mt-3 w-full max-w-md text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-medium">
                {t("date")}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {t("legendVisits")}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {t("legendReads")}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...days].reverse().map((day) => (
              <tr key={day.day} className="border-t border-border/60">
                <th scope="row" className="py-1 font-normal">
                  {date(day.day, "long")}
                </th>
                <td className="py-1 text-right">{format.number(day.views)}</td>
                <td className="py-1 text-right">{format.number(day.reads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
