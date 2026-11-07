/**
 * Splits a paragraph into pieces of a sentence or so (at most ~220 characters) for speech: some
 * browsers stop long utterances partway, and short pieces let pausing and speed changes act fast.
 */
export function speechChunks(text: string, max = 220): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const sentences = flat.match(/[^.!?…]+(?:[.!?…]+["”»’)]*|$)\s*/g) ?? [flat];
  const chunks: string[] = [];
  let current = "";
  const push = (piece: string) => {
    if (piece.trim()) chunks.push(piece.trim());
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push(current);
      current = "";
      // A very long sentence breaks at commas, then at spaces.
      let rest = sentence;
      while (rest.length > max) {
        const window = rest.slice(0, max);
        const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" "));
        const at = cut > max / 3 ? cut + 1 : max;
        push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      current = rest;
    } else if ((current + sentence).length > max) {
      push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  push(current);
  return chunks;
}

/** What listen mode needs from a browser voice (the shape of SpeechSynthesisVoice). */
export type VoiceInfo = { name: string; lang: string; localService: boolean; default: boolean; voiceURI: string };

export const VOICE_STORAGE_PREFIX = "fogata:voice:";

// Sound effects and singing voices (macOS ships these for every Mac); never offered for reading.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical)\b/i;
// Clearly synthetic voices: offered, but only picked when nothing better is there.
const ROBOTIC = /\b(espeak|fred|junior|ralph|kathy|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
// What browsers call their more natural voices (Apple's downloads, Microsoft's online voices).
const NATURAL = /\b(natural|neural|premium|enhanced|siri|wavenet)\b/i;

/** "en-US" / "en_us" → "en". */
const baseLanguage = (lang: string) => lang.toLowerCase().replace("_", "-").split("-")[0] ?? "";

/** How natural a voice is likely to sound, from its name (higher is better). */
export function voiceScore(voice: VoiceInfo): number {
  let score = 0;
  if (NATURAL.test(voice.name)) score += 4;
  if (/google/i.test(voice.name)) score += 2;
  if (ROBOTIC.test(voice.name)) score -= 3;
  if (voice.default) score += 1;
  return score;
}

/** The voices that can read a story in `lang`, most natural first (no novelty voices). */
export function voicesFor<V extends VoiceInfo>(voices: readonly V[], lang: string): V[] {
  return voices
    .map((voice, index) => ({ voice, index }))
    .filter(({ voice }) => baseLanguage(voice.lang) === lang && !NOVELTY.test(voice.name))
    // Ties go to voices on the device, then to the browser's own order.
    .sort((a, b) => voiceScore(b.voice) - voiceScore(a.voice) || Number(b.voice.localService) - Number(a.voice.localService) || a.index - b.index)
    .map(({ voice }) => voice);
}

/**
 * The voice to use: the reader's saved choice if this device still has it, else the most natural
 * voice on the device itself (online voices only when the reader picks one), else whatever there is.
 */
export function pickVoice<V extends VoiceInfo>(ranked: readonly V[], saved: string | null): V | null {
  const chosen = saved ? ranked.find((voice) => voice.voiceURI === saved || voice.name === saved) : undefined;
  return chosen ?? ranked.find((voice) => voice.localService) ?? ranked[0] ?? null;
}

/** Who an online voice sends the text to, when its name says. */
export function voiceProvider(voice: VoiceInfo): "google" | "microsoft" | "other" {
  if (/google/i.test(voice.name)) return "google";
  if (/microsoft/i.test(voice.name)) return "microsoft";
  return "other";
}

/** "Microsoft Aria Online (Natural) - English (United States)", "en-US" → "Microsoft Aria Online (Natural) · US". */
export function voiceLabel(voice: VoiceInfo): string {
  const name = voice.name.replace(/\s+-\s+[^-]+$/, "").trim() || voice.name;
  const region = voice.lang.replace("_", "-").split("-")[1];
  return region && !name.toLowerCase().includes(region.toLowerCase()) ? `${name} · ${region.toUpperCase()}` : name;
}
