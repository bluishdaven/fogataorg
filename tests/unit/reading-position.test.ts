import { describe, expect, it } from "vitest";
import { readLocalPositions, storedProgress, withLocalPosition, worthResuming } from "@/lib/domain/reading-position";

describe("continue reading", () => {
  it("offers to resume only part-way through", () => {
    expect(worthResuming({ blockId: "b", progress: 0.4 })).toBe(true);
    expect(worthResuming({ blockId: "b", progress: 0.02 })).toBe(false);
    expect(worthResuming({ blockId: "b", progress: 0.97 })).toBe(false);
    expect(worthResuming({ blockId: null, progress: 0.4 })).toBe(false);
    expect(worthResuming(null)).toBe(false);
  });

  it("counts reaching the end as finished", () => {
    expect(storedProgress(0.4, 0.6)).toBe(0.4);
    expect(storedProgress(0.3, 0.96)).toBe(1);
  });

  it("keeps visitors' newest 50 places and ignores junk", () => {
    expect(readLocalPositions("not json")).toEqual({});
    expect(readLocalPositions(JSON.stringify({ a: { blockId: "x", progress: 0.5, at: 1 }, b: { progress: "nope" } }))).toEqual({ a: { blockId: "x", progress: 0.5, at: 1 } });
    let all = {};
    for (let n = 0; n < 60; n += 1) all = withLocalPosition(all, `story-${n}`, { blockId: null, progress: 0.5 }, n);
    expect(Object.keys(all)).toHaveLength(50);
    expect(Object.keys(all)).toContain("story-59");
    expect(Object.keys(all)).not.toContain("story-0");
  });
});
