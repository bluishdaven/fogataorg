import { describe, expect, it } from "vitest";
import { clampText, ogPaths, previewVersion } from "@/lib/domain/og";
import { profileUpdateSchema, readInfluences } from "@/lib/domain/profile";
import { unsplashShareImageUrl } from "@/lib/domain/unsplash";

const base = { displayName: "Dana", username: "danawrites", bio: "", links: [] };

describe("profile extras", () => {
  it("default to nothing, so older forms keep working", () => {
    expect(profileUpdateSchema.parse(base)).toMatchObject({ pronouns: "", nowFocus: "reading", nowText: "", influences: {} });
  });

  it("tidy pronouns and the Now line, and cap their length", () => {
    const parsed = profileUpdateSchema.parse({ ...base, pronouns: "  she /  her ", nowFocus: "listening", nowText: " Cantora,\n Mercedes Sosa " });
    expect(parsed).toMatchObject({ pronouns: "she / her", nowFocus: "listening", nowText: "Cantora, Mercedes Sosa" });
    const issues = (input: object) => profileUpdateSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ pronouns: "x".repeat(41) })).toContain("pronouns");
    expect(issues({ nowText: "x".repeat(121) })).toContain("nowText");
    expect(issues({ nowFocus: "eating" })).not.toHaveLength(0);
  });

  it("keep up to five influences per kind, dropping blanks and repeats", () => {
    const parsed = profileUpdateSchema.parse({
      ...base,
      influences: { books: ["Pedro Páramo", "", "  pedro páramo ", "Rayuela"], movies: [""], politics: ["Social democracy"] },
    });
    expect(parsed.influences).toEqual({ books: ["Pedro Páramo", "Rayuela"], politics: ["Social democracy"] });
    const issues = (influences: object) =>
      profileUpdateSchema.safeParse({ ...base, influences }).error?.issues.map((i) => i.message) ?? [];
    expect(issues({ music: ["a", "b", "c", "d", "e", "f"] })).toContain("tooManyInfluences");
    expect(issues({ music: ["x".repeat(81)] })).toContain("influence");
    expect(issues({ sports: ["Fútbol"] })).toEqual([]);
    expect(profileUpdateSchema.parse({ ...base, influences: { sports: ["Fútbol"] } }).influences).toEqual({});
  });

  it("read stored influences defensively (rows can be written through the Data API)", () => {
    expect(readInfluences(null)).toEqual({});
    expect(readInfluences("books")).toEqual({});
    expect(
      readInfluences({ books: ["Rayuela", 42, "x".repeat(81), "rayuela"], music: "Sosa", movies: Array.from({ length: 9 }, (_, i) => `M${i}`), other: ["x"] }),
    ).toEqual({ books: ["Rayuela"], movies: ["M0", "M1", "M2", "M3", "M4"] });
  });
});

describe("share previews", () => {
  it("version a preview by what it shows", () => {
    expect(previewVersion("Dana", 3, null)).toBe(previewVersion("Dana", 3, null));
    expect(previewVersion("Dana", 3)).not.toBe(previewVersion("Dana", 4));
    expect(previewVersion("ab", "c")).not.toBe(previewVersion("a", "bc"));
    expect(previewVersion("Lucía")).toMatch(/^[0-9a-z]+$/);
  });

  it("clamp long text at a word", () => {
    expect(clampText("Short title", 40)).toBe("Short title");
    expect(clampText("The heron knows something I don't, and neither do you", 30)).toBe("The heron knows something I…");
    expect(clampText("  spaced\n\nout  ", 40)).toBe("spaced out");
  });

  it("build image routes that keep handles and slugs safe", () => {
    expect(ogPaths.site("es")).toBe("/api/og/site?locale=es");
    expect(ogPaths.profile("lucia_ortega", "abc")).toBe("/api/og/profile/lucia_ortega?v=abc");
    expect(ogPaths.story("dana", "a b/c", "v1")).toBe("/api/og/story/dana/a%20b%2Fc?v=v1");
  });

  it("hotlink Unsplash pictures as a 1200×630 JPEG crop, keeping their tracking id", () => {
    const url = new URL(unsplashShareImageUrl("https://images.unsplash.com/photo-1?ixid=abc&auto=format&w=400"));
    expect(url.hostname).toBe("images.unsplash.com");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ ixid: "abc", w: "1200", h: "630", fit: "crop", fm: "jpg" });
    expect(url.searchParams.has("auto")).toBe(false);
  });
});
