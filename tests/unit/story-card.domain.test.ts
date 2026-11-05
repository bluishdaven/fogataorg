import { describe, expect, it } from "vitest";
import { fitTitle, readableProfileUrl, storyImageFileName, wrapLines } from "@/lib/domain/story-card";

// A fake ruler: every character is 10px wide (at size 10; scales with size in fitTitle).
const measure = (text: string) => text.length * 10;

describe("wrapLines", () => {
  it("fills lines greedily without breaking words", () => {
    expect(wrapLines("the heron knows something", 120, measure)).toEqual(["the heron", "knows", "something"]);
  });

  it("ends at a whole word with an ellipsis when it runs out of lines", () => {
    const lines = wrapLines("one two three four five six seven eight nine ten", 140, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^[a-z ]+…$/);
    expect(lines[1]!.endsWith(" …")).toBe(false);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(140);
    // The cut never splits a word.
    const words = "one two three four five six seven eight nine ten".split(" ");
    for (const word of lines[1]!.replace("…", "").trim().split(" ")) expect(words).toContain(word);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(wrapLines("aaa bbb, ccc ddd eee fff", 80, measure, 1)).toEqual(["aaa…"]);
  });

  it("breaks a single word that is wider than the line", () => {
    expect(wrapLines("supercalifragilistic", 80, measure)).toEqual(["supercal", "ifragili", "stic"]);
  });
});

describe("fitTitle", () => {
  const measureAt = (size: number) => (text: string) => text.length * size * 0.5;

  it("uses the largest size that fits in the allowed lines", () => {
    const short = fitTitle("A short title", 900, measureAt, { max: 100, min: 64, maxLines: 4 });
    expect(short.size).toBe(100);
    expect(short.lines).toEqual(["A short title"]);
  });

  it("shrinks long titles, and truncates only at the smallest size", () => {
    const long = "Un título muy largo sobre una abuela, un mole sin receta y todos los domingos que olían a chocolate";
    const fitted = fitTitle(long, 900, measureAt, { max: 100, min: 64, maxLines: 4 });
    expect(fitted.size).toBeLessThan(100);
    expect(fitted.lines.length).toBeLessThanOrEqual(4);

    const endless = fitTitle(`${long} ${long} ${long}`, 900, measureAt, { max: 100, min: 64, maxLines: 4 });
    expect(endless.size).toBe(64);
    expect(endless.lines).toHaveLength(4);
    expect(endless.lines[3]!.endsWith("…")).toBe(true);
  });
});

describe("share image helpers", () => {
  it("shows a readable address", () => {
    expect(readableProfileUrl("https://fogata.org/@nvgntx/yo-no-soy-digno")).toBe("fogata.org/@nvgntx");
    expect(readableProfileUrl("https://www.fogata.org/@ana/x")).toBe("fogata.org/@ana");
    expect(readableProfileUrl("not a url")).toBe("not a url");
  });

  it("names the file after the story", () => {
    expect(storyImageFileName("el-mole-de-mi-abuela")).toBe("fogata-el-mole-de-mi-abuela.png");
    expect(storyImageFileName("../../etc")).toBe("fogata-etc.png");
    expect(storyImageFileName("")).toBe("fogata-story.png");
  });
});
