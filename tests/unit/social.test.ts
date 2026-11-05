import { describe, expect, it } from "vitest";
import { normalizeQuery, parseSearchParams } from "@/lib/domain/search";
import { blockTexts, responseSchema, splitMentions } from "@/lib/domain/social";

const ID = "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f";

describe("splitMentions", () => {
  it("finds @handles but not emails", () => {
    expect(splitMentions("Hola @lucia_ortega, write to me@fogata.test")).toEqual([
      { type: "text", value: "Hola " },
      { type: "mention", handle: "lucia_ortega" },
      { type: "text", value: ", write to me@fogata.test" },
    ]);
    expect(splitMentions("@dana first")).toEqual([
      { type: "mention", handle: "dana" },
      { type: "text", value: " first" },
    ]);
    expect(splitMentions("no mentions @ab")).toEqual([{ type: "text", value: "no mentions @ab" }]);
  });
});

describe("responseSchema", () => {
  it("trims, collapses blank lines and enforces length", () => {
    const base = { storyId: ID, parentId: null, blockId: null };
    expect(responseSchema.parse({ ...base, body: "  Hola\r\n\r\n\r\n\r\nmundo  " }).body).toBe("Hola\n\nmundo");
    expect(responseSchema.safeParse({ ...base, body: "   " }).error?.issues[0]?.message).toBe("empty");
    expect(responseSchema.safeParse({ ...base, body: "x".repeat(4001) }).error?.issues[0]?.message).toBe("tooLong");
    expect(responseSchema.safeParse({ ...base, blockId: "not-a-block", body: "hi" }).success).toBe(false);
  });
});

describe("blockTexts", () => {
  it("maps top-level block ids to their text", () => {
    expect(
      blockTexts({
        content: [
          { attrs: { id: ID }, content: [{ text: "Primera " }, { text: "línea" }] },
          { attrs: { id: "bad" }, content: [{ text: "ignored" }] },
          { attrs: {}, content: [{ text: "no id" }] },
        ],
      }),
    ).toEqual({ [ID]: "Primera línea" });
  });
});

describe("search params", () => {
  it("normalizes queries and falls back to all languages", () => {
    expect(parseSearchParams({ q: "  Canción   de cuna ", lang: "fr" })).toEqual({ q: "Canción de cuna", lang: "all" });
    expect(parseSearchParams({ q: ["array"] })).toEqual({ q: "", lang: "all" });
    expect(normalizeQuery("Canción ÑANDÚ")).toBe("cancion nandu");
  });
});
