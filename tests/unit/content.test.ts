import { describe, expect, it } from "vitest";
import { countWords, excerpt, readingTimeMinutes, tiptapToText, type TiptapDoc } from "@/lib/domain/content";
import { slugify, uniqueSlug } from "@/lib/domain/slug";

const doc: TiptapDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Lo que no se mide" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "En su cocina " },
        { type: "text", text: "nada", marks: [{ type: "bold" }] },
        { type: "text", text: " se pesaba." },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Chiles" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Ajonjolí" }] }] },
      ],
    },
  ],
};

describe("tiptapToText", () => {
  it("joins blocks with newlines and inline marks seamlessly", () => {
    expect(tiptapToText(doc)).toBe("Lo que no se mide\nEn su cocina nada se pesaba.\nChiles\nAjonjolí");
  });

  it("handles empty documents", () => {
    expect(tiptapToText({ type: "doc", content: [] })).toBe("");
  });
});

describe("countWords", () => {
  it("counts accented words, contractions and hyphenated words once", () => {
    expect(countWords("El niño comió piña, ¿verdad?")).toBe(5);
    expect(countWords("It's a twelve-year-old's guitar")).toBe(4);
    expect(countWords("  \n ")).toBe(0);
  });
});

describe("readingTimeMinutes", () => {
  it("never returns less than a minute", () => {
    expect(readingTimeMinutes("hola", "es")).toBe(1);
  });

  it("reads Spanish a little slower than English", () => {
    const text = Array.from({ length: 1090 }, () => "palabra").join(" ");
    expect(readingTimeMinutes(text, "es")).toBe(5);
    expect(readingTimeMinutes(text, "en")).toBe(5);
    const long = Array.from({ length: 2400 }, () => "word").join(" ");
    expect(readingTimeMinutes(long, "en")).toBe(10);
    expect(readingTimeMinutes(long, "es")).toBe(11);
  });
});

describe("excerpt", () => {
  it("returns short text untouched", () => {
    expect(excerpt("Una línea corta.")).toBe("Una línea corta.");
  });

  it("cuts long text on a word boundary with an ellipsis", () => {
    const result = excerpt("The heron stands in the shallows on one leg, waiting for nothing at all.", 40);
    expect(result).toBe("The heron stands in the shallows on one…");
    expect(result.length).toBeLessThanOrEqual(41);
  });
});

describe("slugify", () => {
  it("folds accents and ñ", () => {
    expect(slugify("Pienso en inglés, sueño en español")).toBe("pienso-en-ingles-sueno-en-espanol");
    expect(slugify("¿Qué pasó en la Ciudad de México?")).toBe("que-paso-en-la-ciudad-de-mexico");
  });

  it("handles ampersands, apostrophes and repeated separators", () => {
    expect(slugify("Rivers & Birds — Notes")).toBe("rivers-and-birds-notes");
    expect(slugify("The heron knows something I don't")).toBe("the-heron-knows-something-i-dont");
  });

  it("limits length on a word boundary", () => {
    const slug = slugify("a very long title that keeps going and going well beyond what fits", 30);
    expect(slug.length).toBeLessThanOrEqual(30);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("appends a counter until the slug is free", async () => {
    const taken = new Set(["el-mole", "el-mole-2"]);
    await expect(uniqueSlug("el-mole", (s) => taken.has(s))).resolves.toBe("el-mole-3");
    await expect(uniqueSlug("", () => false)).resolves.toBe("story");
  });
});
