import { describe, expect, it } from "vitest";
import { feedQuery, feedsFor, fillFeed, parseFeed } from "@/lib/domain/feeds";
import { languagesSchema, parseStep, swapLocale, topicsSchema, welcomePath } from "@/lib/domain/onboarding";
import { looksAutomated, readerHash } from "@/lib/domain/reads";

describe("home feeds", () => {
  it("offer Latest and Burning now to visitors, all four to readers", () => {
    expect(feedsFor(false)).toEqual(["latest", "burning"]);
    expect(feedsFor(true)).toEqual(["for-you", "following", "burning", "latest"]);
  });

  it("fall back to the first available tab", () => {
    expect(parseFeed(undefined, true)).toBe("for-you");
    expect(parseFeed("following", false)).toBe("latest");
    expect(parseFeed("burning", false)).toBe("burning");
    expect(parseFeed(["burning"], true)).toBe("for-you");
  });

  it("keep the default tab on the plain home URL", () => {
    expect(feedQuery("for-you", true)).toEqual({});
    expect(feedQuery("latest", false)).toEqual({});
    expect(feedQuery("latest", true)).toEqual({ feed: "latest" });
  });

  it("top up a thin feed without repeating stories", () => {
    const item = (key: string) => ({ key });
    expect(fillFeed([item("a"), item("b")], [item("b"), item("c"), item("d")], 3).map((i) => i.key)).toEqual(["a", "b", "c"]);
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
