import type { TiptapDoc, TiptapMark, TiptapNode } from "../../src/lib/domain/content";

/**
 * Converts the small Markdown subset used by seed stories into Tiptap JSON:
 * ## / ### headings, > quotes, - and 1. lists, --- rules, paragraphs, and
 * inline **bold**, *italic* and [links](https://…). Not a general parser;
 * real Markdown import arrives with Phase 5.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    let marks: TiptapMark[] | undefined;
    let value = part;
    if (part.startsWith("**") && part.endsWith("**")) {
      value = part.slice(2, -2);
      marks = [{ type: "bold" }];
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      value = part.slice(1, -1);
      marks = [{ type: "italic" }];
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (link?.[1] && link[2]) {
        value = link[1];
        marks = [{ type: "link", attrs: { href: link[2] } }];
      }
    }
    nodes.push(marks ? { type: "text", text: value, marks } : { type: "text", text: value });
  }
  return nodes;
}

function paragraph(text: string): TiptapNode {
  return { type: "paragraph", content: inline(text.replace(/\s*\n\s*/g, " ").trim()) };
}

export function markdownToTiptap(source: string): TiptapDoc {
  const blocks = source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const content: TiptapNode[] = blocks.map((block) => {
    if (block === "---") return { type: "horizontalRule" };
    if (block.startsWith("### ")) {
      return { type: "heading", attrs: { level: 3 }, content: inline(block.slice(4)) };
    }
    if (block.startsWith("## ")) {
      return { type: "heading", attrs: { level: 2 }, content: inline(block.slice(3)) };
    }
    const lines = block.split("\n").map((line) => line.trim());
    if (lines.every((line) => line.startsWith(">"))) {
      const text = lines.map((line) => line.replace(/^>\s?/, "")).join("\n");
      return { type: "blockquote", content: [paragraph(text)] };
    }
    if (lines.every((line) => line.startsWith("- "))) {
      return {
        type: "bulletList",
        content: lines.map((line) => ({ type: "listItem", content: [paragraph(line.slice(2))] })),
      };
    }
    if (lines.every((line) => /^\d+\.\s/.test(line))) {
      return {
        type: "orderedList",
        attrs: { start: 1 },
        content: lines.map((line) => ({
          type: "listItem",
          content: [paragraph(line.replace(/^\d+\.\s/, ""))],
        })),
      };
    }
    return paragraph(block);
  });

  return { type: "doc", content };
}
