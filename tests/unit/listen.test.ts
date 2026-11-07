import { describe, expect, it } from "vitest";
import { pickVoice, speechChunks, voiceLabel, voiceProvider, voicesFor, type VoiceInfo } from "@/lib/domain/listen";

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

const voice = (name: string, lang: string, localService = true, isDefault = false): VoiceInfo => ({
  name,
  lang,
  localService,
  default: isDefault,
  voiceURI: `uri:${name}`,
});

describe("voices", () => {
  const all = [
    voice("Fred", "en-US"),
    voice("Bubbles", "en-US"),
    voice("Samantha", "en-US", true, true),
    voice("Ava (Premium)", "en-US"),
    voice("Google US English", "en-US", false),
    voice("Microsoft Aria Online (Natural) - English (United States)", "en-US", false),
    voice("Mónica", "es-ES"),
    voice("Paulina", "es_MX"),
  ];

  it("offers the story's language only, most natural first, never sound-effect voices", () => {
    expect(voicesFor(all, "en").map((v) => v.name)).toEqual([
      "Ava (Premium)",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Google US English",
      "Samantha",
      "Fred",
    ]);
    expect(voicesFor(all, "es").map((v) => v.name)).toEqual(["Mónica", "Paulina"]);
  });

  it("picks the reader's saved voice, else the best one on the device (never an online one by itself)", () => {
    const english = voicesFor(all, "en");
    expect(pickVoice(english, null)?.name).toBe("Ava (Premium)");
    expect(pickVoice(english, "uri:Google US English")?.name).toBe("Google US English");
    expect(pickVoice(english, "Samantha")?.name).toBe("Samantha");
    expect(pickVoice(english, "uri:gone")?.name).toBe("Ava (Premium)");
    expect(pickVoice(voicesFor([voice("Google español", "es-ES", false)], "es"), null)?.name).toBe("Google español");
    expect(pickVoice([], null)).toBeNull();
  });

  it("names voices briefly and says who online ones send the text to", () => {
    expect(voiceLabel(all[5]!)).toBe("Microsoft Aria Online (Natural) · US");
    expect(voiceLabel(all[4]!)).toBe("Google US English");
    expect(voiceLabel(all[7]!)).toBe("Paulina · MX");
    expect(voiceProvider(all[4]!)).toBe("google");
    expect(voiceProvider(all[5]!)).toBe("microsoft");
    expect(voiceProvider(all[2]!)).toBe("other");
  });
});
