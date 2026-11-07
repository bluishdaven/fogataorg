import type { TiptapDoc, TiptapMark, TiptapNode } from "../content";

/**
 * Turns an exported post's HTML (already parsed into a DOM) into the story document the editor and
 * `sanitizeStoryDoc()` understand: paragraphs, headings, quotes, pull quotes, lists, code, rules and
 * figures. Anything else is flattened to its text; embeds become a link; scripts, styles, forms
 * and subscribe buttons are dropped. Every top-level block gets an id. Figures keep their original
 * `src` here: the server copies them into our storage before saving.
 */

export type ConvertOptions = {
  newId: () => string;
  /** The post's title and subtitle; a leading heading repeating them is dropped. */
  title?: string;
  subtitle?: string;
};

const ELEMENT = 1;
const TEXT = 3;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "FORM", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SVG", "TEMPLATE", "HEAD", "META", "LINK", "TITLE"]);
const BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL", "PRE", "HR", "FIGURE", "IMG", "TABLE", "IFRAME", "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "ASIDE", "PICTURE", "CENTER", "DL"]);
const DROP_CLASSES = /\b(button-wrapper|subscription-widget|subscribe-widget|share-dialog|footnote-anchor|post-ufi|captioned-button-wrap)\b/;

const flat = (text: string) => text.replace(/\s+/g, " ").trim();
const isElement = (node: Node): node is Element => node.nodeType === ELEMENT;
const tag = (node: Element) => node.tagName.toUpperCase();

function hasBlockChild(element: Element): boolean {
  return Array.from(element.children).some((child) => BLOCKS.has(tag(child)) && !SKIP.has(tag(child)));
}

function absoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const url = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** The best source for an image: the largest srcset candidate, else src or data-src. */
function imageSource(image: Element): string | null {
  const srcset = image.getAttribute("srcset") ?? image.getAttribute("data-srcset");
  if (srcset) {
    const best = srcset
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/))
      .map(([url, size]) => ({ url, width: Number.parseInt(size ?? "0", 10) || 0 }))
      .sort((a, b) => b.width - a.width)[0];
    const fromSet = absoluteUrl(best?.url);
    if (fromSet) return fromSet;
  }
  const src = absoluteUrl(image.getAttribute("src") ?? image.getAttribute("data-src"));
  // Medium serves resized copies; ask for a large one.
  return src?.replace(/(cdn-images-\d\.medium\.com|miro\.medium\.com)\/max\/\d+\//, "$1/max/2000/") ?? null;
}

function inline(node: Node, marks: TiptapMark[], out: TiptapNode[]) {
  if (node.nodeType === TEXT) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ");
    if (text) out.push(marks.length ? { type: "text", text, marks } : { type: "text", text });
    return;
  }
  if (!isElement(node) || SKIP.has(tag(node))) return;
  const name = tag(node);
  if (name === "BR") {
    out.push({ type: "hardBreak" });
    return;
  }
  if (name === "IMG" || name === "IFRAME") return;
  const added: TiptapMark[] = [];
  if (name === "B" || name === "STRONG") added.push({ type: "bold" });
  if (name === "I" || name === "EM" || name === "CITE") added.push({ type: "italic" });
  if (name === "U") added.push({ type: "underline" });
  if (name === "S" || name === "STRIKE" || name === "DEL") added.push({ type: "strike" });
  if (name === "CODE") added.push({ type: "code" });
  if (name === "A") {
    const href = absoluteUrl(node.getAttribute("href"));
    if (href || node.getAttribute("href")?.startsWith("mailto:")) added.push({ type: "link", attrs: { href: href ?? node.getAttribute("href") } });
  }
  const next = [...marks, ...added.filter((mark) => !marks.some((m) => m.type === mark.type))];
  for (const child of Array.from(node.childNodes)) inline(child, next, out);
}

/** Inline content of an element, trimmed at both ends and with adjacent text merged. */
function inlineContent(element: Node): TiptapNode[] {
  const raw: TiptapNode[] = [];
  for (const child of Array.from(element.childNodes)) inline(child, [], raw);
  const merged: TiptapNode[] = [];
  for (const node of raw) {
    const last = merged[merged.length - 1];
    if (node.type === "text" && last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])) {
      last.text = `${last.text}${node.text}`.replace(/ {2,}/g, " ");
    } else {
      merged.push({ ...node });
    }
  }
  while (merged[0]?.type === "hardBreak") merged.shift();
  while (merged[merged.length - 1]?.type === "hardBreak") merged.pop();
  const first = merged[0];
  if (first?.type === "text") first.text = first.text!.replace(/^\s+/, "");
  const last = merged[merged.length - 1];
  if (last?.type === "text") last.text = last.text!.replace(/\s+$/, "");
  return merged.filter((node) => node.type !== "text" || node.text);
}

export function htmlToDoc(root: Node, options: ConvertOptions): { doc: TiptapDoc; images: string[] } {
  const blocks: TiptapNode[] = [];
  const images: string[] = [];
  const skipLeading = new Set([options.title, options.subtitle].filter(Boolean).map((text) => flat(text!).toLowerCase()));
  const block = (node: TiptapNode) => blocks.push({ ...node, attrs: { ...(node.attrs ?? {}), id: options.newId() } });

  const paragraph = (content: TiptapNode[]) => {
    if (content.length) block({ type: "paragraph", content });
  };

  const figure = (image: Element, caption = "") => {
    const src = imageSource(image);
    if (!src) return;
    images.push(src);
    const width = Number.parseInt(image.getAttribute("data-width") ?? image.getAttribute("width") ?? "", 10);
    const height = Number.parseInt(image.getAttribute("data-height") ?? image.getAttribute("height") ?? "", 10);
    block({
      type: "figure",
      attrs: {
        src,
        alt: flat(image.getAttribute("alt") ?? "").slice(0, 300),
        caption: flat(caption).slice(0, 300),
        layout: "inset",
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null,
        credit: null,
      },
    });
  };

  const listItems = (list: Element): TiptapNode[] =>
    Array.from(list.children)
      .filter((child) => tag(child) === "LI")
      .flatMap((item) => {
        const content: TiptapNode[] = [];
        const text: TiptapNode[] = [];
        for (const child of Array.from(item.childNodes)) {
          if (isElement(child) && (tag(child) === "UL" || tag(child) === "OL")) {
            const nested = listItems(child);
            if (nested.length) content.push({ type: tag(child) === "UL" ? "bulletList" : "orderedList", content: nested });
          } else if (isElement(child) && tag(child) === "P") {
            const inner = inlineContent(child);
            if (inner.length) content.push({ type: "paragraph", content: inner });
          } else {
            inline(child, [], text);
          }
        }
        const wrapper = trimInline(text);
        if (wrapper.length) content.unshift({ type: "paragraph", content: wrapper });
        return content.length ? [{ type: "listItem", content }] : [];
      });

  const walk = (node: Node) => {
    if (node.nodeType === TEXT) {
      // Text sitting between blocks; blank lines separate paragraphs (classic WordPress posts).
      for (const part of (node.textContent ?? "").split(/\n\s*\n/)) {
        const text = flat(part);
        if (text) paragraph([{ type: "text", text }]);
      }
      return;
    }
    if (!isElement(node)) return;
    const name = tag(node);
    if (SKIP.has(name) || DROP_CLASSES.test(node.getAttribute("class") ?? "")) return;

    switch (name) {
      case "P": {
        const pictures = Array.from(node.querySelectorAll("img"));
        if (!pictures.length || flat(node.textContent ?? "")) paragraph(inlineContent(node));
        pictures.forEach((picture) => figure(picture));
        return;
      }
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const text = flat(node.textContent ?? "");
        if (!text) return;
        if (blocks.length === 0 && skipLeading.has(text.toLowerCase())) return;
        block({ type: "heading", attrs: { level: name === "H1" || name === "H2" ? 2 : 3 }, content: inlineContent(node) });
        return;
      }
      case "BLOCKQUOTE": {
        if (/pullquote|pull-quote/.test(node.getAttribute("class") ?? "")) {
          const content = inlineContent(node);
          if (content.length) block({ type: "pullQuote", content });
          return;
        }
        const paragraphs = Array.from(node.children).filter((child) => tag(child) === "P");
        const content = (paragraphs.length ? paragraphs : [node])
          .map((part) => inlineContent(part))
          .filter((inner) => inner.length)
          .map((inner) => ({ type: "paragraph", content: inner }) as TiptapNode);
        if (content.length) block({ type: "blockquote", content });
        return;
      }
      case "UL":
      case "OL": {
        const items = listItems(node);
        if (items.length) block({ type: name === "UL" ? "bulletList" : "orderedList", content: items });
        return;
      }
      case "PRE": {
        const text = (node.textContent ?? "").replace(/\n+$/, "");
        if (text.trim()) block({ type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text }] });
        return;
      }
      case "HR":
        // Medium opens every section with a divider; the first one isn't a break in the story.
        if (blocks.length) block({ type: "horizontalRule" });
        return;
      case "FIGURE": {
        const image = node.querySelector("img");
        const caption = node.querySelector("figcaption")?.textContent ?? "";
        if (image) {
          figure(image, caption);
          return;
        }
        Array.from(node.childNodes).forEach(walk);
        return;
      }
      case "IMG":
        figure(node);
        return;
      case "IFRAME": {
        const src = absoluteUrl(node.getAttribute("src"));
        if (src) paragraph([{ type: "text", text: new URL(src).host, marks: [{ type: "link", attrs: { href: src } }] }]);
        return;
      }
      case "TABLE":
        for (const row of Array.from(node.querySelectorAll("tr"))) {
          const cells = Array.from(row.children).map((cell) => flat(cell.textContent ?? "")).filter(Boolean);
          if (cells.length) paragraph([{ type: "text", text: cells.join(" · ") }]);
        }
        return;
      default:
        if (hasBlockChild(node) || name === "PICTURE") {
          Array.from(node.childNodes).forEach(walk);
        } else if (name !== "A" || flat(node.textContent ?? "")) {
          const image = name === "A" ? node.querySelector("img") : null;
          if (image) figure(image);
          else paragraph(inlineContent(node));
        } else {
          const image = node.querySelector("img");
          if (image) figure(image);
        }
    }
  };

  Array.from(root.childNodes).forEach(walk);
  return { doc: { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph", attrs: { id: options.newId() } }] }, images };
}

/** Trims loose inline content collected from a list item. */
function trimInline(nodes: TiptapNode[]): TiptapNode[] {
  const out = nodes.filter((node) => node.type !== "text" || node.text?.trim());
  const first = out[0];
  if (first?.type === "text") first.text = first.text!.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.type === "text") last.text = last.text!.replace(/\s+$/, "");
  return out;
}
