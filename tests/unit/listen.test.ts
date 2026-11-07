import { describe, expect, it } from "vitest";
import { speechChunks } from "@/lib/domain/listen";

describe("listen mode", () => {
  it("reads short paragraphs in one piece", () => {
    expect(speechChunks("  The heron waits.  It always waits. ")).toEqual(["The heron waits. It always waits."]);
    expect(speechChunks("   ")).toEqual([]);
  });

  it("splits long paragraphs at sentences, and long sentences at commas", () => {
    const sentence = "The water was still and the light was going, ";
    const chunks = speechChunks(`${"Una frase corta. ".repeat(20)}${sentence.repeat(8)}end.`);
    expect(chunks.every((chunk) => chunk.length <= 220)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(`${"Una frase corta. ".repeat(20)}${sentence.repeat(8)}end.`.replace(/\s+/g, " ").trim());
    expect(chunks[0]!.endsWith(".")).toBe(true);
  });

  it("keeps closing quotes with their sentence", () => {
    expect(speechChunks("«Ya voy», dijo. “Wait!” she said.")).toEqual(["«Ya voy», dijo. “Wait!” she said."]);
  });
});
