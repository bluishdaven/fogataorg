"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Heading2, Heading3, Italic, Link2, Quote, Strikethrough } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { safeHref } from "@/lib/domain/story-doc";
import { cn } from "@/lib/utils";

/** Formatting toolbar that appears only when text is selected. */
export function SelectionToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("Editor");
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      quote: e.isActive("blockquote"),
    }),
  });

  const applyLink = (event: FormEvent) => {
    event.preventDefault();
    const url = href.trim() ? safeHref(/^[a-z]+:/i.test(href.trim()) ? href.trim() : `https://${href.trim()}`) : null;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url) chain.setLink({ href: url }).run();
    else chain.unsetLink().run();
    setLinking(false);
    setHref("");
  };

  return (
    <BubbleMenu
      editor={editor}
      // Only for text the writer selected: a new editor can start with everything selected
      // (and unfocused), which must not open the toolbar over an empty draft.
      shouldShow={({ editor: e, view, element, state: s, from, to }) =>
        (view.hasFocus() || element.contains(document.activeElement)) &&
        !s.selection.empty &&
        s.doc.textBetween(from, to).trim().length > 0 &&
        !e.isActive("figure") &&
        !e.isActive("codeBlock")
      }
      className="rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      {/* Tiptap doesn't pass data attributes to the floating element, so they live in here. */}
      <div role="toolbar" aria-label={t("formatting")} className="flex items-center gap-0.5" data-testid="selection-toolbar">
        {linking ? (
          <form onSubmit={applyLink} className="flex items-center gap-1">
            <input
              autoFocus
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setLinking(false)}
              placeholder={t("linkPlaceholder")}
              aria-label={t("link")}
              className="h-8 w-56 rounded-md bg-transparent px-2 text-sm outline-none"
            />
          </form>
        ) : (
          <>
            <ToolButton label={t("bold")} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold />
            </ToolButton>
            <ToolButton label={t("italic")} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic />
            </ToolButton>
            <ToolButton label={t("strike")} active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
              <Strikethrough />
            </ToolButton>
            <ToolButton
              label={t("link")}
              active={state.link}
              onClick={() => {
                setHref((editor.getAttributes("link").href as string | undefined) ?? "");
                setLinking(true);
              }}
            >
              <Link2 />
            </ToolButton>
            <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
            <ToolButton label={t("heading")} active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 />
            </ToolButton>
            <ToolButton label={t("subheading")} active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 />
            </ToolButton>
            <ToolButton label={t("quote")} active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote />
            </ToolButton>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md hover:bg-accent [&_svg]:size-4",
        active && "bg-ember-soft text-ember-text",
      )}
    >
      {children}
    </button>
  );
}
