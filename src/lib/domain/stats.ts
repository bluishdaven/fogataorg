import { z } from "zod";

/**
 * Writer stats: the arithmetic behind /me/stats, kept pure so it's tested without a database.
 * Days are UTC dates ("2026-11-12"), oldest first, as `writer_daily_reads()` returns them.
 */

/** The overview compares the last 30 days with the 30 before. */
export const STATS_PERIOD_DAYS = 30;

/** Paragraphs show up as "loved" once this many readers kept them as embers (the SQL says 2 too). */
export const LOVED_PASSAGE_MIN_READERS = 2;

export const statsStoryIdSchema = z.uuid();

export type DailyReads = { day: string; views: number; reads: number; readSeconds: number };

export type PeriodTotals = { views: number; reads: number; readSeconds: number };

export function totals(days: readonly DailyReads[]): PeriodTotals {
  return days.reduce(
    (sum, day) => ({ views: sum.views + day.views, reads: sum.reads + day.reads, readSeconds: sum.readSeconds + day.readSeconds }),
    { views: 0, reads: 0, readSeconds: 0 },
  );
}

/** Splits `2 × length` days into the earlier and the later `length` (shorter input fills the earlier). */
export function splitPeriods(days: readonly DailyReads[], length = STATS_PERIOD_DAYS) {
  const current = days.slice(-length);
  const previous = days.slice(0, Math.max(0, days.length - length)).slice(-length);
  return { current, previous };
}

/** Share of visits that became reads, 0–1, or null with no visits. */
export function readRatio(views: number, reads: number): number | null {
  if (views <= 0) return null;
  return Math.min(1, reads / views);
}

/** Average seconds a reader spent, or null with no reads. */
export function averageSeconds(seconds: number, reads: number): number | null {
  if (reads <= 0) return null;
  return Math.round(seconds / reads);
}

/** Relative change from `previous` to `current` (0.25 = up a quarter), or null when there's nothing to compare. */
export function change(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** Minutes and seconds for reading times ("4:05"). */
export function formatDuration(seconds: number): { minutes: number; seconds: number } {
  const whole = Math.max(0, Math.round(seconds));
  return { minutes: Math.floor(whole / 60), seconds: whole % 60 };
}

/** A round top for a chart axis: 1, 2 or 5 times a power of ten, at least `value` (and at least 5). */
export function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

export type ReadDepth = { visitors: number; quarter: number; half: number; threeQuarters: number; finished: number };

/** Each milestone as a share of visitors (0–1), for the read-depth bars. */
export function depthShares(depth: ReadDepth) {
  const share = (count: number) => (depth.visitors > 0 ? Math.min(1, count / depth.visitors) : 0);
  return [
    { key: "quarter", count: depth.quarter, share: share(depth.quarter) },
    { key: "half", count: depth.half, share: share(depth.half) },
    { key: "threeQuarters", count: depth.threeQuarters, share: share(depth.threeQuarters) },
    { key: "finished", count: depth.finished, share: share(depth.finished) },
  ] as const;
}

/** The loved paragraphs' text from the story, skipping any the story no longer has. */
export function lovedPassages(
  passages: readonly { blockId: string; readers: number }[],
  texts: Record<string, string>,
): { blockId: string; readers: number; text: string }[] {
  return passages.flatMap((passage) => {
    const text = texts[passage.blockId];
    return text && passage.readers >= LOVED_PASSAGE_MIN_READERS ? [{ ...passage, text }] : [];
  });
}
