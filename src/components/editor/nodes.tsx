"use client";

import { mergeAttributes, Node, type CommandProps } from "@tiptap/core";
import { AllSelection, NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import {
  defaultImageLayout,
  figureMaxWidth,
  figureSizeClass,
  IMAGE_LAYOUTS,
  type FigureAttrs,
  type ImageLayout,
} from "@/lib/domain/story-doc";
import { isUnsplashImageUrl, unsplashImageUrl } from "@/lib/domain/unsplash";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: { insertFigure: (attrs: Partial<FigureAttrs> & { src: string }) => ReturnType };
    callout: { setCallout: () => ReturnType };
    pullQuote: { setPullQuote: () => ReturnType };
  }
}

/** Display URL for an image inside the editor (Unsplash images are resized on their CDN). */
export function editorImageSrc(src: string): string {
  return isUnsplashImageUrl(src) ? unsplashImageUrl(src, { width: 1600 }) : src;
}

const SIZE_LABEL: Record<ImageLayout, "sizeSmall" | "sizeMedium" | "sizeLarge" | "sizeWide"> = {
  small: "sizeSmall",
  medium: "sizeMedium",
  inset: "sizeLarge",
  wide: "sizeWide",
};

function FigureView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const t = useTranslations("Editor");
  const attrs = node.attrs as FigureAttrs;
  const missingAlt = !attrs.alt?.trim();
  const layout: ImageLayout = (IMAGE_LAYOUTS as readonly string[]).includes(attrs.layout) ? attrs.layout : "inset";

  return (
    <NodeViewWrapper as="figure" data-figure="" className={cn("figure not-prose", figureSizeClass(layout))}>
      {/* Same sizing as the published story; the controls sit on the picture's own corner. */}
      <div
        className={cn("relative mx-auto overflow-hidden rounded-lg bg-muted", selected && "ring-3 ring-ring")}
        style={{ maxWidth: figureMaxWidth(attrs.width, attrs.height) }}
        data-drag-handle
      >
        {/* Plain <img>: editor previews show the stored file as-is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={editorImageSrc(attrs.src)}
          alt={attrs.alt}
          width={attrs.width ?? undefined}
          height={attrs.height ?? undefined}
          className="block h-auto w-full"
          draggable={false}
        />
        <div contentEditable={false} className="absolute top-2 right-2 flex gap-1 rounded-lg bg-background/90 p-1 shadow-sm">
          <div role="group" aria-label={t("sizeLabel")} className="flex gap-0.5" data-testid="figure-size">
            {IMAGE_LAYOUTS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={t(SIZE_LABEL[option])}
                aria-pressed={layout === option}
                title={t(SIZE_LABEL[option])}
                onClick={() => updateAttributes({ layout: option })}
                className={cn(
                  "relative flex size-7 items-center justify-center rounded-md text-xs font-semibold hover:bg-accent after:absolute after:-inset-1.5 sm:after:hidden",
                  layout === option && "bg-ember-soft text-ember-text",
                )}
              >
                {t(`${SIZE_LABEL[option]}Short`)}
              </button>
            ))}
          </div>
          <span className="mx-0.5 w-px self-stretch bg-border" aria-hidden />
          <Button type="button" size="icon-xs" variant="ghost" aria-label={t("removeImage")} onClick={() => deleteNode()}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div contentEditable={false} className="mt-2 flex flex-col gap-1.5 font-sans text-sm">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", missingAlt ? "text-destructive" : "text-muted-foreground")}>
            {missingAlt ? t("altRequired") : t("altLabel")}
          </span>
          <input
            value={attrs.alt ?? ""}
            onChange={(event) => updateAttributes({ alt: event.target.value.slice(0, 300) })}
            placeholder={t("altPlaceholder")}
            aria-invalid={missingAlt || undefined}
            className="rounded-md border border-input bg-transparent px-2 py-1.5 focus-visible:border-ring"
            data-testid="figure-alt"
          />
        </label>
        <input
          value={attrs.caption ?? ""}
          onChange={(event) => updateAttributes({ caption: event.target.value.slice(0, 300) })}
          placeholder={t("captionPlaceholder")}
          aria-label={t("captionLabel")}
          className="rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-muted-foreground hover:border-input focus-visible:border-ring"
        />
        {attrs.credit ? <UnsplashCredit credit={attrs.credit} className="text-center" /> : null}
      </div>
    </NodeViewWrapper>
  );
}

export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: "" },
      layout: { default: "inset" },
      width: { default: null },
      height: { default: null },
      credit: { default: null },
    };
  },

  // Only our own figures parse from HTML; pasted <img> tags from other sites are dropped.
  parseHTML() {
    return [{ tag: "figure[data-figure]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", { "data-figure": "" }, ["img", { src: HTMLAttributes.src, alt: HTMLAttributes.alt }]];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView, {
      // Let the alt/caption inputs handle their own keys and clicks.
      stopEvent: ({ event }) => event.target instanceof HTMLInputElement,
    });
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands, state }: CommandProps) => {
          const content = [
            {
              type: this.name,
              attrs: { alt: "", caption: "", layout: defaultImageLayout(attrs.width, attrs.height), credit: null, ...attrs },
            },
            { type: "paragraph" },
          ];
          // A photo goes at the cursor, but never replaces a selected block or the whole story
          // (an editor that hasn't been tapped yet may have its first image or everything selected).
          const { selection, doc } = state;
          if (selection instanceof NodeSelection) return commands.insertContentAt(selection.to, content);
          if (selection instanceof AllSelection) {
            const blank = doc.childCount === 1 && doc.firstChild?.isTextblock === true && doc.firstChild.content.size === 0;
            return commands.insertContentAt(blank ? { from: 0, to: doc.content.size } : doc.content.size, content);
          }
          return commands.insertContent(content);
        },
    };
  },
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "aside[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "callout" }), 0];
  },
  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }: CommandProps) =>
          commands.setNode(this.name),
    };
  },
});

export const PullQuote = Node.create({
  name: "pullQuote",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "p[data-pull-quote]", priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-pull-quote": "", class: "pull-quote" }), 0];
  },
  addCommands() {
    return {
      setPullQuote:
        () =>
        ({ commands }: CommandProps) =>
          commands.setNode(this.name),
    };
  },
});
