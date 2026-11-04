import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/domain/redirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNextPath("/es/design?tab=type#reading", "/")).toBe("/es/design?tab=type#reading");
    expect(safeNextPath("/@dana/heron", "/")).toBe("/@dana/heron");
  });

  it.each([
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["evil.example"],
    ["/ok\tbut-tab"],
    ["/ok\nbut-newline"],
    [""],
    ["/" + "a".repeat(600)],
  ])("rejects %j", (input) => {
    expect(safeNextPath(input, "/en")).toBe("/en");
  });

  it("rejects non-strings", () => {
    expect(safeNextPath(undefined, "/en")).toBe("/en");
    expect(safeNextPath(42, "/en")).toBe("/en");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNextPath("/en/../es", "/")).toBe("/es");
  });
});
