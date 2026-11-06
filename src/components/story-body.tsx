import type { ReactNode } from "react";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import type { TiptapMark, TiptapNode } from "@/lib/domain/content";
import { figureMaxWidth, figureSizeClass, safeHref, type FigureAttrs } from "@/lib/domain/story-doc";
import { imageCreditSchema, isUnsplashImageUrl, unsplashImageUrl } from "@/lib/domain/unsplash";
import { cn } from "@/lib/utils";

export { safeHref };

/**
 * Server-side renderer for stored Tiptap JSON. Only allowlisted node and mark
 * types render; anything else is dropped. No HTML strings are ever injected,
 * so stored content can't run scripts. Images render only from `imagePrefixes`.
 */

type RenderContext = { imagePrefixes: readonly string[] };

function blockProps(node: TiptapNode): { "data-block"?: string } {
  const id = node.attrs?.id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/.test(id) ? { "data-block": id } : {};
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
      case "underline":
        return <u key={k}>{child}</u>;
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

function renderChildren(node: TiptapNode, key: string, ctx: RenderContext): ReactNode[] {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`, ctx));
}

function FigureBlock({ node, ctx }: { node: TiptapNode; ctx: RenderContext }) {
  const attrs = node.attrs as Partial<FigureAttrs> | undefined;
  const src = typeof attrs?.src === "string" ? attrs.src : "";
  if (!src || !ctx.imagePrefixes.some((prefix) => src.startsWith(prefix))) return null;
  const alt = typeof attrs?.alt === "string" ? attrs.alt : "";
  const caption = typeof attrs?.caption === "string" ? attrs.caption : "";
  const credit = imageCreditSchema.safeParse(attrs?.credit);
  const width = typeof attrs?.width === "number" ? attrs.width : null;
  const height = typeof attrs?.height === "number" ? attrs.height : null;
  const layout = attrs?.layout;
  const wide = layout === "wide";
  const sizes = wide
    ? "(min-width: 1100px) 1100px, 100vw"
    : layout === "small"
      ? "(min-width: 768px) 360px, 60vw"
      : layout === "medium"
        ? "(min-width: 768px) 520px, 90vw"
        : "(min-width: 768px) 720px, 100vw";
  // Pictures fill their size, but tall ones narrow (centered) so they never outgrow the screen.
  const imageClass = "mx-auto block h-auto w-full rounded-lg";
  const imageStyle = { maxWidth: figureMaxWidth(width, height) };

  let image: ReactNode;
  if (isUnsplashImageUrl(src) && width && height) {
    image = (
      <UnsplashImage rawUrl={src} alt={alt} width={width} height={height} sizes={sizes} className={imageClass} style={imageStyle} />
    );
  } else {
    image = (
      // Uploaded images are already resized and re-encoded on upload.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={isUnsplashImageUrl(src) ? unsplashImageUrl(src, { width: 1600 }) : src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
        decoding="async"
        className={imageClass}
        style={imageStyle}
      />
    );
  }

  return (
    <figure className={cn("figure", figureSizeClass(layout))} {...blockProps(node)}>
      {image}
      {caption || credit.success ? (
        <figcaption>
          {caption ? <span className="block">{caption}</span> : null}
          {credit.success ? <UnsplashCredit credit={credit.data} className="mt-0.5 text-[0.75rem]" /> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function renderNode(node: TiptapNode, key: string, ctx: RenderContext): ReactNode {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks, key);
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return (
        <p key={key} {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </p>
      );
    case "heading": {
      const Tag = node.attrs?.level === 3 ? "h3" : "h2";
      return (
        <Tag key={key} {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote key={key} {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </blockquote>
      );
    case "pullQuote":
      return (
        <p key={key} className="pull-quote" {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </p>
      );
    case "callout":
      return (
        <aside key={key} className="callout" {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </aside>
      );
    case "bulletList":
      return (
        <ul key={key} {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </ul>
      );
    case "orderedList": {
      const start = typeof node.attrs?.start === "number" && node.attrs.start > 1 ? node.attrs.start : undefined;
      return (
        <ol key={key} start={start} {...blockProps(node)}>
          {renderChildren(node, key, ctx)}
        </ol>
      );
    }
    case "listItem":
      return <li key={key}>{renderChildren(node, key, ctx)}</li>;
    case "codeBlock":
      return (
        <pre key={key} {...blockProps(node)}>
          <code>{renderChildren(node, key, ctx)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} />;
    case "figure":
      return <FigureBlock key={key} node={node} ctx={ctx} />;
    default:
      return null;
  }
}

export function StoryBody({
  doc,
  lang,
  imagePrefixes = [],
}: {
  doc: TiptapNode;
  lang: string;
  /** URL prefixes images may load from; anything else is not rendered. */
  imagePrefixes?: readonly string[];
}) {
  return (
    <div className="prose-fogata mx-auto" lang={lang}>
      {renderChildren(doc, "n", { imagePrefixes })}
    </div>
  );
}
