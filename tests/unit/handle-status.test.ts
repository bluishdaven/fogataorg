import { describe, expect, it } from "vitest";
import { handleStatusFromRow, wantsHandleCheck } from "@/lib/domain/handle-status";

describe("share URL status", () => {
  it("finds profiles and visible stories", () => {
    expect(handleStatusFromRow({ username: "ana", moved_to: null, story: null }, { handle: "Ana" })).toEqual({ kind: "found" });
    expect(handleStatusFromRow({ username: "ana", moved_to: null, story: true }, { handle: "ana", slug: "rio" })).toEqual({ kind: "found" });
  });

  it("calls hidden or missing stories and unknown people missing", () => {
    expect(handleStatusFromRow({ username: "ana", moved_to: null, story: false }, { handle: "ana", slug: "rio" })).toEqual({ kind: "missing" });
    expect(handleStatusFromRow({ username: null, moved_to: null, story: null }, { handle: "nadie" })).toEqual({ kind: "missing" });
    expect(handleStatusFromRow(null, { handle: "nadie", slug: "x" })).toEqual({ kind: "missing" });
  });

  it("sends old usernames to the current one, keeping the story slug", () => {
    expect(handleStatusFromRow({ username: null, moved_to: "Ana_R", story: false }, { handle: "ana", slug: "rio" })).toEqual({
      kind: "moved",
      to: { handle: "Ana_R", slug: "rio" },
    });
  });

  it("checks page loads but not the app's own fetches", () => {
    expect(wantsHandleCheck("document")).toBe(true);
    expect(wantsHandleCheck(null)).toBe(true);
    expect(wantsHandleCheck("empty")).toBe(false);
  });
});

describe("series addresses", () => {
  it("route /@handle/series/slug to the series page and back", async () => {
    const { matchPublicHandlePath, toInternalHandlePath, matchInternalHandlePath, publicHandlePath } = await import("@/lib/domain/handle-routes");
    const route = matchPublicHandlePath("/@ana/series/the-river");
    expect(route).toEqual({ handle: "ana", series: "the-river" });
    expect(toInternalHandlePath("es", route!)).toBe("/es/u/ana/series/the-river");
    expect(matchInternalHandlePath("/es/u/ana/series/the-river")).toEqual({ locale: "es", route: { handle: "ana", series: "the-river" } });
    expect(publicHandlePath(route!)).toBe("/@ana/series/the-river");
    // A story called "series" is still a story.
    expect(matchPublicHandlePath("/@ana/series")).toEqual({ handle: "ana", slug: "series" });
  });

  it("call a missing series missing", () => {
    expect(handleStatusFromRow({ username: "ana", moved_to: null, story: null, series: false }, { handle: "ana", series: "x" })).toEqual({ kind: "missing" });
    expect(handleStatusFromRow({ username: "ana", moved_to: null, story: null, series: true }, { handle: "ana", series: "x" })).toEqual({ kind: "found" });
  });
});
