import { describe, expect, it } from "vitest";
import {
  averageSeconds,
  change,
  depthShares,
  formatDuration,
  lovedPassages,
  niceCeiling,
  readRatio,
  splitPeriods,
  totals,
  type DailyReads,
} from "@/lib/domain/stats";

const day = (n: number, views: number, reads: number, readSeconds = reads * 120): DailyReads => ({
  day: `2026-10-${String(n).padStart(2, "0")}`,
  views,
  reads,
  readSeconds,
});

describe("writer stats", () => {
  it("add up days and split them into this period and the one before", () => {
    const days = [day(1, 4, 1), day(2, 6, 3), day(3, 10, 5), day(4, 2, 2)];
    const { current, previous } = splitPeriods(days, 2);
    expect(totals(current)).toEqual({ views: 12, reads: 7, readSeconds: 840 });
    expect(totals(previous)).toEqual({ views: 10, reads: 4, readSeconds: 480 });
    // Shorter histories (a new account) leave the earlier period short or empty.
    expect(splitPeriods(days.slice(0, 1), 2)).toEqual({ current: days.slice(0, 1), previous: [] });
    expect(totals([])).toEqual({ views: 0, reads: 0, readSeconds: 0 });
  });

  it("turn counts into ratios, averages and changes, or nothing when there's no base", () => {
    expect(readRatio(10, 4)).toBe(0.4);
    expect(readRatio(0, 0)).toBeNull();
    expect(readRatio(3, 5)).toBe(1);
    expect(averageSeconds(600, 4)).toBe(150);
    expect(averageSeconds(0, 0)).toBeNull();
    expect(change(15, 10)).toBe(0.5);
    expect(change(5, 10)).toBe(-0.5);
    expect(change(5, 0)).toBeNull();
    expect(formatDuration(245)).toEqual({ minutes: 4, seconds: 5 });
    expect(formatDuration(-3)).toEqual({ minutes: 0, seconds: 0 });
  });

  it("pick round chart ceilings", () => {
    expect(niceCeiling(0)).toBe(5);
    expect(niceCeiling(7)).toBe(10);
    expect(niceCeiling(11)).toBe(20);
    expect(niceCeiling(48)).toBe(50);
    expect(niceCeiling(51)).toBe(100);
    expect(niceCeiling(1200)).toBe(2000);
  });

  it("show read depth as shares of visitors", () => {
    const shares = depthShares({ visitors: 20, quarter: 15, half: 10, threeQuarters: 6, finished: 4 });
    expect(shares.map((s) => s.share)).toEqual([0.75, 0.5, 0.3, 0.2]);
    expect(depthShares({ visitors: 0, quarter: 0, half: 0, threeQuarters: 0, finished: 0 }).every((s) => s.share === 0)).toBe(true);
  });

  it("show loved paragraphs only when the story still has them and enough readers kept them", () => {
    const texts = { a: "The kettle sang.", b: "Smoke rose." };
    expect(
      lovedPassages(
        [
          { blockId: "a", readers: 3 },
          { blockId: "gone", readers: 5 },
          { blockId: "b", readers: 1 },
        ],
        texts,
      ),
    ).toEqual([{ blockId: "a", readers: 3, text: "The kettle sang." }]);
  });
});
