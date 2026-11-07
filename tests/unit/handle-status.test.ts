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
