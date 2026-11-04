import type { ReactNode } from "react";
import type { TiptapMark, TiptapNode } from "@/lib/domain/content";

/**
 * Server-side renderer for stored Tiptap JSON. Only allowlisted node and mark
 * types render; anything else is dropped. No HTML strings are ever injected,
 * so stored content can't run scripts.
 */

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value, "https://fogata.org");
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function applyMarks(text: ReactNode, marks: TiptapMark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return text;
  return marks.reduce<ReactNode>((child, mark, index) => {
    const k = `${key}-m${index}`;
    switch (mark.type) {
      case "bold":
        return <strong key={k}>{child}</strong>;
      case "italic":
        return <em key={k}>{child}</em>;
      case "strike":
        return <s key={k}>{child}</s>;
      case "code":
        return <code key={k}>{child}</code>;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        return href ? (
          <a key={k} href={href} rel="noopener noreferrer nofollow ugc" target="_blank">
            {child}
          </a>
        ) : (
          child
        );
      }
      default:
        return child;
    }
  }, text);
}

function renderChildren(node: TiptapNode, key: string): ReactNode[] {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
}

function renderNode(node: TiptapNode, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks, key);
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return <p key={key}>{renderChildren(node, key)}</p>;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      const Tag = level === 3 ? "h3" : "h2";
      return <Tag key={key}>{renderChildren(node, key)}</Tag>;
    }
    case "blockquote":
      return <blockquote key={key}>{renderChildren(node, key)}</blockquote>;
    case "bulletList":
      return <ul key={key}>{renderChildren(node, key)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderChildren(node, key)}</ol>;
    case "listItem":
      return <li key={key}>{renderChildren(node, key)}</li>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{renderChildren(node, key)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    default:
      return null;
  }
}

export function StoryBody({ doc, lang }: { doc: TiptapNode; lang: string }) {
  return (
    <div className="prose-fogata mx-auto" lang={lang}>
      {renderChildren(doc, "n")}
    </div>
  );
}
