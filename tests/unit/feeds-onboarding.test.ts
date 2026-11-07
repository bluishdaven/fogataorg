import { describe, expect, it } from "vitest";
import { FEEDS, feedQuery, parseFeed } from "@/lib/domain/feeds";
import { languagesSchema, parseStep, swapLocale, topicsSchema, welcomePath } from "@/lib/domain/onboarding";
import { looksAutomated, readerHash } from "@/lib/domain/reads";

describe("home feeds", () => {
  it("are Latest (the default, on the plain home URL) and Following", () => {
    expect(FEEDS).toEqual(["latest", "following"]);
    expect(parseFeed(undefined)).toBe("latest");
    expect(parseFeed("following")).toBe("following");
    expect(parseFeed("burning")).toBe("latest");
    expect(parseFeed(["following"])).toBe("latest");
    expect(feedQuery("latest")).toEqual({});
    expect(feedQuery("following")).toEqual({ feed: "following" });
  });
});

describe("onboarding", () => {
  it("sends new readers to the welcome page in the right language, remembering where they were going", () => {
    expect(welcomePath("/es")).toBe("/es/welcome");
    expect(welcomePath("/")).toBe("/en/welcome");
    expect(welcomePath("/", "es")).toBe("/es/welcome");
    expect(welcomePath("/es/circles/huerto")).toBe("/es/welcome?next=%2Fes%2Fcircles%2Fhuerto");
    expect(welcomePath("https://evil.example/")).toBe("/en/welcome");
  });

  it("switch the welcome page's language in place", () => {
    expect(swapLocale("/en/welcome?step=topics", "es")).toBe("/es/welcome?step=topics");
  });

  it("validate each step", () => {
    expect(parseStep("writers")).toBe("writers");
    expect(parseStep("nope")).toBe("languages");
    expect(languagesSchema.parse({ locale: "es", readingLanguages: ["es", "es", "en"] }).readingLanguages).toEqual(["es", "en"]);
    expect(languagesSchema.safeParse({ locale: "es", readingLanguages: [] }).success).toBe(false);
    expect(topicsSchema.safeParse({ topics: ["poetry", "poetry", "nature"] }).success).toBe(false);
    expect(topicsSchema.parse({ topics: ["poetry", "nature", "travel"] }).topics).toHaveLength(3);
  });
});

describe("reads", () => {
  it("key readers by day so their days can't be linked", () => {
    const monday = readerHash("s", "2026-11-09", "203.0.113.7");
    expect(monday).toHaveLength(40);
    expect(readerHash("s", "2026-11-09", "203.0.113.7")).toBe(monday);
    expect(readerHash("s", "2026-11-10", "203.0.113.7")).not.toBe(monday);
    expect(readerHash("t", "2026-11-09", "203.0.113.7")).not.toBe(monday);
    expect(monday).not.toContain("203");
  });

  it("skip crawlers and previews", () => {
    expect(looksAutomated("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(looksAutomated(null)).toBe(true);
    expect(looksAutomated("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1.15")).toBe(false);
  });
});
