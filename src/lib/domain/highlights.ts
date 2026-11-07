import { z } from "zod";

export const QUOTE_MAX = 600;

export const highlightInputSchema = z.object({
  storyId: z.uuid(),
  blockId: z.string().regex(/^[0-9a-f-]{36}$/),
  quote: z.string().trim().min(1).max(QUOTE_MAX),
  /** Where the reader's selection started in the block's text, to pick the right repeat. */
  near: z.number().int().min(0).max(100_000),
});
export type HighlightInput = z.input<typeof highlightInputSchema>;

export type Passage = { start: number; end: number };

/** Finds `quote` in a block's text, choosing the occurrence closest to `near`. */
export function locateQuote(text: string, quote: string, near = 0): Passage | null {
  if (!quote) return null;
  let best: number | null = null;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    if (best === null || Math.abs(at - near) < Math.abs(best - near)) best = at;
  }
  return best === null ? null : { start: best, end: best + quote.length };
}

/** Percent-encodes a text fragment term; `-`, `,` and `&` are syntax there, so they're encoded too. */
function fragmentTerm(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/**
 * The text fragment for a quote (`text=start,end` for long ones), so supporting browsers scroll to
 * and mark the exact words.
 */
export function quoteFragment(quote: string): string {
  const flat = quote.replace(/\s+/g, " ").trim();
  if (flat.length <= 80) return `text=${fragmentTerm(flat)}`;
  const words = flat.split(" ");
  return `text=${fragmentTerm(words.slice(0, 5).join(" "))},${fragmentTerm(words.slice(-5).join(" "))}`;
}

/**
 * A link to a passage: the paragraph's anchor (every browser) plus a text fragment (browsers that
 * support it highlight the words).
 */
export function passageUrl(storyUrl: string, blockId: string, quote: string): string {
  return `${storyUrl.split("#")[0]}#p-${blockId}:~:${quoteFragment(quote)}`;
}

export function quoteCardFileName(slug: string): string {
  return `fogata-quote-${slug}.png`.slice(0, 120);
}
