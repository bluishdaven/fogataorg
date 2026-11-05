/**
 * Layout rules for the "Stories" share image (1080×1920, the size Instagram,
 * WhatsApp and Facebook use for stories). Pure functions, so the canvas code
 * only draws; text measuring is passed in.
 */

export const STORY_IMAGE = { width: 1080, height: 1920, margin: 96 } as const;

export type Measure = (text: string) => number;

/** Greedy word wrap. Overflowing text ends in "…" on the last allowed line. */
export function wrapLines(text: string, maxWidth: number, measure: Measure, maxLines = Infinity): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the line (long URLs, compounds) breaks by character.
    let rest = word;
    while (measure(rest) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && measure(rest.slice(0, cut)) > maxWidth) cut -= 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  // Cut at a whole word, then add the ellipsis.
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (measure(`${last}…`) > maxWidth && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
  kept[maxLines - 1] = `${last.replace(/[\s,.;:!?—–-]+$/u, "")}…`;
  return kept;
}

/** The largest title size (stepping down from `max`) that fits in `maxLines`; truncates at `min`. */
export function fitTitle(
  title: string,
  maxWidth: number,
  measureAt: (size: number) => Measure,
  { max = 100, min = 64, step = 4, maxLines = 4 } = {},
): { size: number; lines: string[] } {
  for (let size = max; size > min; size -= step) {
    const lines = wrapLines(title, maxWidth, measureAt(size));
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: min, lines: wrapLines(title, maxWidth, measureAt(min), maxLines) };
}

/** "https://fogata.org/@ana/slug" → "fogata.org/@ana", the part people can read off a screen. */
export function readableProfileUrl(storyUrl: string): string {
  try {
    const url = new URL(storyUrl);
    const handle = url.pathname.split("/").find((part) => part.startsWith("@"));
    return `${url.host.replace(/^www\./, "")}${handle ? `/${handle}` : ""}`;
  } catch {
    return storyUrl;
  }
}

/** Safe file name for the downloaded image. */
export function storyImageFileName(slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `fogata-${safe || "story"}.png`;
}
