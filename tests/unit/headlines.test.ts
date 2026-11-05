// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { HEADLINE_COUNT, HEADLINE_SCRIPT, HEADLINE_STORAGE_KEY, headlineCss, pickHeadline } from "@/lib/domain/headlines";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

describe("home headlines", () => {
  it("have the same count in the script and in both languages", () => {
    expect(en.Home.headlines).toHaveLength(HEADLINE_COUNT);
    expect(es.Home.headlines).toHaveLength(HEADLINE_COUNT);
  });

  it("never repeat the last visit's, and can land on any other", () => {
    const seen = new Set<number>();
    for (let step = 0; step < 100; step += 1) {
      const index = pickHeadline(HEADLINE_COUNT, 4, step / 100);
      expect(index).not.toBe(4);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(HEADLINE_COUNT);
      seen.add(index);
    }
    expect(seen.size).toBe(HEADLINE_COUNT - 1);
  });

  it("pick from all of them on a first visit or with a bad stored value", () => {
    expect(pickHeadline(12, null, 0.999)).toBe(11);
    expect(pickHeadline(12, 40, 0)).toBe(0);
    expect(pickHeadline(12, Number.NaN, 0.5)).toBe(6);
    expect(pickHeadline(1, 0, 0.5)).toBe(0);
  });

  it("only show the picked one", () => {
    const css = headlineCss(3);
    expect(css).toContain("[data-headline-option]{display:none}");
    expect(css).toContain('html:not([data-headline]) [data-headline-option="0"]{display:inline}');
    expect(css).toContain('html[data-headline="2"] [data-headline-option="2"]{display:inline}');
  });
});

describe("HEADLINE_SCRIPT", () => {
  const run = () => {
    new Function(HEADLINE_SCRIPT)();
    return Number(document.documentElement.getAttribute("data-headline"));
  };

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-headline");
  });

  it("picks a different headline on each visit and remembers it", () => {
    let last = run();
    for (let visit = 0; visit < 200; visit += 1) {
      const next = run();
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(HEADLINE_COUNT);
      expect(window.localStorage.getItem(HEADLINE_STORAGE_KEY)).toBe(String(next));
      last = next;
    }
  });

  it("still picks one when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const index = run();
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(HEADLINE_COUNT);
  });
});
