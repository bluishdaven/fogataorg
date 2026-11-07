// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollBehavior } from "@/lib/utils";

const prefers = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query === "(prefers-reduced-motion: reduce)" }));

afterEach(() => vi.unstubAllGlobals());

describe("scrollBehavior", () => {
  it("scrolls smoothly by default", () => {
    prefers(false);
    expect(scrollBehavior()).toBe("smooth");
  });

  it("jumps when the reader asked for less motion", () => {
    prefers(true);
    expect(scrollBehavior()).toBe("auto");
  });
});
