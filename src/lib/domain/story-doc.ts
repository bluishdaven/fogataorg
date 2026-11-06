import type { TiptapDoc, TiptapMark, TiptapNode } from "./content";
import { imageCreditSchema, type ImageCredit } from "./unsplash";

/**
 * Server-side allowlist for stored story documents. Whatever the editor (or a
 * hand-crafted request) sends, only these node types, marks and attributes are
 * stored. Anything unknown is dropped; anything unsafe rejects the save.
 */

export const STORY_DOC_LIMITS = {
  maxBytes: 400_000,
  maxDepth: 10,
  maxNodes: 25_000,
  maxTextLength: 20_000,
} as const;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const BLOCK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE_LANGUAGE = /^[a-z0-9+#-]{1,20}$/;

/** http(s) or mailto links only; returns a normalized URL or null. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value, "https://fogata.org");
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Picture sizes: small and medium sit centered in the column, "inset" fills it (Large), "wide" breaks out. */
export const IMAGE_LAYOUTS = ["small", "medium", "inset", "wide"] as const;
export type ImageLayout = (typeof IMAGE_LAYOUTS)[number];

/** CSS class for a picture size (globals.css); Large ("inset") is the plain column width. */
export function figureSizeClass(layout: unknown): string | false {
  return layout === "wide" ? "figure-wide" : layout === "small" ? "figure-small" : layout === "medium" ? "figure-medium" : false;
}

/**
 * Width cap that keeps a picture no taller than 85% of the screen while it still fills its size:
 * only tall pictures get narrower (centered). Unknown dimensions: no cap.
 */
export function figureMaxWidth(width: number | null | undefined, height: number | null | undefined): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return `min(100%, calc(85vh * ${Number((width / height).toFixed(4))}))`;
}

/** Tall pictures start at Medium so a portrait doesn't fill the whole screen. */
export function defaultImageLayout(width: number | null | undefined, height: number | null | undefined): ImageLayout {
  return width && height && height > width * 1.15 ? "medium" : "inset";
}

export type FigureAttrs = {
  id?: string;
  src: string;
  alt: string;
  caption: string;
  layout: ImageLayout;
  width: number | null;
  height: number | null;
  credit: ImageCredit | null;
};

type Context = {
  imagePrefixes: readonly string[];
  nodes: number;
};

export class StoryDocError extends Error {
  constructor(readonly reason: "too_large" | "too_deep" | "unsafe_image" | "invalid") {
    super(reason);
    this.name = "StoryDocError";
  }
}

function isAllowedImage(src: unknown, prefixes: readonly string[]): src is string {
  if (typeof src !== "string" || src.length > 2048) return false;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
      return false;
    }
  } catch {
    return false;
  }
  return prefixes.some((prefix) => src.startsWith(prefix));
}

function blockId(attrs: Record<string, unknown> | undefined): { id?: string } {
  const id = attrs?.id;
  return typeof id === "string" && BLOCK_ID.test(id) ? { id } : {};
}

function boundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function positiveInt(value: unknown, max = 20_000): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max ? value : null;
}

function sanitizeMarks(marks: unknown): TiptapMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: TiptapMark[] = [];
  for (const mark of marks) {
    if (!mark || typeof mark !== "object") continue;
    const type = (mark as TiptapMark).type;
    if (type === "bold" || type === "italic" || type === "strike" || type === "code" || type === "underline") {
      out.push({ type });
    } else if (type === "link") {
      const href = safeHref((mark as TiptapMark).attrs?.href);
      if (href) out.push({ type: "link", attrs: { href } });
    }
  }
  return out.length ? out : undefined;
}

function sanitizeInline(content: unknown, ctx: Context, depth: number): TiptapNode[] {
  if (!Array.isArray(content)) return [];
  const out: TiptapNode[] = [];
  for (const child of content) {
    countNode(ctx, depth);
    if (!child || typeof child !== "object") continue;
    const node = child as TiptapNode;
    if (node.type === "text" && typeof node.text === "string" && node.text.length > 0) {
      const marks = sanitizeMarks(node.marks);
      const text = node.text.slice(0, STORY_DOC_LIMITS.maxTextLength);
      out.push(marks ? { type: "text", text, marks } : { type: "text", text });
    } else if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    }
  }
  return out;
}

function countNode(ctx: Context, depth: number) {
  ctx.nodes += 1;
  if (ctx.nodes > STORY_DOC_LIMITS.maxNodes) throw new StoryDocError("too_large");
  if (depth > STORY_DOC_LIMITS.maxDepth) throw new StoryDocError("too_deep");
}

function withContent(node: TiptapNode, content: TiptapNode[]): TiptapNode {
  return content.length ? { ...node, content } : node;
}

function sanitizeBlocks(content: unknown, ctx: Context, depth: number, allowed: ReadonlySet<string>): TiptapNode[] {
  if (!Array.isArray(content)) return [];
  const out: TiptapNode[] = [];
  for (const child of content) {
    const node = sanitizeBlock(child, ctx, depth, allowed);
    if (node) out.push(node);
  }
  return out;
}

const TOP_LEVEL = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "pullQuote",
  "callout",
  "bulletList",
  "orderedList",
  "codeBlock",
  "horizontalRule",
  "figure",
]);
const IN_QUOTE = new Set(["paragraph"]);
const IN_LIST_ITEM = new Set(["paragraph", "bulletList", "orderedList"]);

function sanitizeBlock(input: unknown, ctx: Context, depth: number, allowed: ReadonlySet<string>): TiptapNode | null {
  countNode(ctx, depth);
  if (!input || typeof input !== "object") return null;
  const node = input as TiptapNode;
  if (!allowed.has(node.type)) return null;
  const attrs = node.attrs;

  switch (node.type) {
    case "paragraph":
    case "pullQuote":
    case "callout":
      return withContent({ type: node.type, attrs: blockId(attrs) }, sanitizeInline(node.content, ctx, depth + 1));
    case "heading": {
      const level = attrs?.level === 3 ? 3 : 2;
      return withContent({ type: "heading", attrs: { ...blockId(attrs), level } }, sanitizeInline(node.content, ctx, depth + 1));
    }
    case "blockquote": {
      const content = sanitizeBlocks(node.content, ctx, depth + 1, IN_QUOTE);
      return content.length ? { type: "blockquote", attrs: blockId(attrs), content } : null;
    }
    case "bulletList":
    case "orderedList": {
      const items = (Array.isArray(node.content) ? node.content : []).flatMap((item) => {
        countNode(ctx, depth + 1);
        if (!item || typeof item !== "object" || (item as TiptapNode).type !== "listItem") return [];
        const content = sanitizeBlocks((item as TiptapNode).content, ctx, depth + 2, IN_LIST_ITEM);
        return content.length ? [{ type: "listItem", attrs: blockId((item as TiptapNode).attrs), content }] : [];
      });
      if (!items.length) return null;
      const listAttrs =
        node.type === "orderedList" ? { ...blockId(attrs), start: positiveInt(attrs?.start, 10_000) ?? 1 } : blockId(attrs);
      return { type: node.type, attrs: listAttrs, content: items };
    }
    case "codeBlock": {
      const language = typeof attrs?.language === "string" && CODE_LANGUAGE.test(attrs.language) ? attrs.language : null;
      const text = sanitizeInline(node.content, ctx, depth + 1)
        .filter((n) => n.type === "text")
        .map((n) => ({ type: "text", text: n.text }) as TiptapNode);
      return withContent({ type: "codeBlock", attrs: { ...blockId(attrs), language } }, text);
    }
    case "horizontalRule":
      return { type: "horizontalRule", attrs: blockId(attrs) };
    case "figure": {
      if (!isAllowedImage(attrs?.src, ctx.imagePrefixes)) throw new StoryDocError("unsafe_image");
      const credit = imageCreditSchema.safeParse(attrs?.credit);
      const figure: FigureAttrs = {
        ...blockId(attrs),
        src: attrs.src as string,
        alt: boundedString(attrs?.alt, 300),
        caption: boundedString(attrs?.caption, 300),
        layout: (IMAGE_LAYOUTS as readonly unknown[]).includes(attrs?.layout) ? (attrs.layout as ImageLayout) : "inset",
        width: positiveInt(attrs?.width),
        height: positiveInt(attrs?.height),
        credit: credit.success ? credit.data : null,
      };
      return { type: "figure", attrs: figure };
    }
    default:
      return null;
  }
}

/**
 * Returns a cleaned copy of the document, or throws StoryDocError.
 * `imagePrefixes` lists URL prefixes images may come from (Unsplash, our bucket).
 */
export function sanitizeStoryDoc(input: unknown, imagePrefixes: readonly string[]): TiptapDoc {
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(input) ?? "").length;
  } catch {
    throw new StoryDocError("invalid");
  }
  if (bytes > STORY_DOC_LIMITS.maxBytes) throw new StoryDocError("too_large");
  if (!input || typeof input !== "object" || (input as TiptapNode).type !== "doc") {
    throw new StoryDocError("invalid");
  }
  const ctx: Context = { imagePrefixes, nodes: 0 };
  const content = sanitizeBlocks((input as TiptapNode).content, ctx, 1, TOP_LEVEL);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** Every figure in reading order. */
export function figuresOf(doc: TiptapNode): FigureAttrs[] {
  const out: FigureAttrs[] = [];
  const walk = (node: TiptapNode) => {
    if (node.type === "figure" && node.attrs) out.push(node.attrs as FigureAttrs);
    node.content?.forEach(walk);
  };
  walk(doc);
  return out;
}

/** Headings in order, for a table of contents. */
export function headingsOf(doc: TiptapNode): { id?: string; level: 2 | 3; text: string }[] {
  return (doc.content ?? [])
    .filter((node) => node.type === "heading")
    .map((node) => ({
      id: typeof node.attrs?.id === "string" ? node.attrs.id : undefined,
      level: node.attrs?.level === 3 ? 3 : 2,
      text: (node.content ?? []).map((child) => child.text ?? "").join(""),
    }));
}
