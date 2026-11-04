import type { Locale } from "./locale";

/**
 * Minimal Tiptap/ProseMirror JSON shape. The editor (Phase 1) produces this;
 * the renderer only understands an allowlist of node and mark types.
 */
export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export type TiptapDoc = TiptapNode & { type: "doc" };

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "bulletList",
  "orderedList",
  "codeBlock",
  "horizontalRule",
  "pullQuote",
  "callout",
]);

/** Plain text of a document, one line per block. Used for search, excerpts and reading time. */
export function tiptapToText(node: TiptapNode): string {
  const lines: string[] = [];
  let current = "";

  const walk = (n: TiptapNode) => {
    if (n.type === "text" && n.text) {
      current += n.text;
      return;
    }
    if (n.type === "hardBreak") {
      current += "\n";
      return;
    }
    n.content?.forEach(walk);
    if (BLOCK_TYPES.has(n.type) && current.trim().length > 0) {
      lines.push(current.trim());
      current = "";
    }
  };

  walk(node);
  if (current.trim().length > 0) lines.push(current.trim());
  return lines.join("\n");
}

export function countWords(text: string): number {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

/**
 * Average silent-reading speeds. Spanish words are longer on average, so
 * readers cover fewer of them per minute.
 */
const WORDS_PER_MINUTE: Record<Locale, number> = { en: 238, es: 218 };

export function readingTimeMinutes(text: string, language: Locale): number {
  return Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE[language]));
}

/** First ~maxLength characters of the text, cut on a word boundary. */
export function excerpt(text: string, maxLength = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  const cut = flat.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}
