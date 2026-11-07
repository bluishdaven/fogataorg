import { describe, expect, it } from "vitest";
import { highlightInputSchema, locateQuote, passageUrl, quoteFragment } from "@/lib/domain/highlights";

describe("embers and passage links", () => {
  it("find a quote in its paragraph, picking the repeat nearest the selection", () => {
    const text = "the fire, the fire, and the water";
    expect(locateQuote(text, "the fire", 0)).toEqual({ start: 0, end: 8 });
    expect(locateQuote(text, "the fire", 11)).toEqual({ start: 10, end: 18 });
    expect(locateQuote(text, "the moon", 0)).toBeNull();
  });

  it("validate what the browser sends", () => {
    expect(highlightInputSchema.safeParse({ storyId: crypto.randomUUID(), blockId: crypto.randomUUID(), quote: "  hola  ", near: 3 }).data?.quote).toBe("hola");
    expect(highlightInputSchema.safeParse({ storyId: crypto.randomUUID(), blockId: "nope", quote: "hola", near: 0 }).success).toBe(false);
    expect(highlightInputSchema.safeParse({ storyId: crypto.randomUUID(), blockId: crypto.randomUUID(), quote: "x".repeat(601), near: 0 }).success).toBe(false);
  });

  it("build text fragments, escaping their syntax and shortening long quotes", () => {
    expect(quoteFragment("well-lit, & warm")).toBe("text=well%2Dlit%2C%20%26%20warm");
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen";
    expect(quoteFragment(long)).toBe("text=one%20two%20three%20four%20five,thirteen%20fourteen%20fifteen%20sixteen%20seventeen");
  });

  it("link to the paragraph with the fragment after it", () => {
    expect(passageUrl("https://fogata.org/@ana/rio#responses", "abc", "río")).toBe("https://fogata.org/@ana/rio#p-abc:~:text=r%C3%ADo");
  });
});
