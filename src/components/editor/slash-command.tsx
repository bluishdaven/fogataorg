"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import type { LucideIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The "/" menu. Items are built (and translated) by the editor component and
 * passed in through `getItems`, so the menu itself has no copy of its own.
 */

export type SlashItem = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  run: (editor: Editor, range: Range) => void;
};

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase().normalize("NFKD").replace(/\p{M}+/gu, "");
  if (!q) return items;
  return items.filter((item) =>
    [item.title, ...item.keywords].some((word) =>
      word.toLowerCase().normalize("NFKD").replace(/\p{M}+/gu, "").includes(q),
    ),
  );
}

type MenuHandle = { onKeyDown: (event: KeyboardEvent) => boolean };
type MenuProps = SuggestionProps<SlashItem> & { emptyLabel: string };

const SlashMenu = forwardRef<MenuHandle, MenuProps>(function SlashMenu({ items, command, emptyLabel }, ref) {
  const [active, setActive] = useState(0);
  const [lastItems, setLastItems] = useState(items);
  // Reset the highlight whenever the filtered list changes.
  if (items !== lastItems) {
    setLastItems(items);
    setActive(0);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="/"
      className="max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      data-testid="slash-menu"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
});

function place(element: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  element.style.position = "fixed";
  element.style.zIndex = "60";
  element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 296))}px`;
  const below = rect.bottom + 6;
  const height = element.offsetHeight || 320;
  element.style.top = below + height > window.innerHeight ? `${Math.max(8, rect.top - height - 6)}px` : `${below}px`;
}

export const SlashCommand = Extension.create<{ getItems: () => SlashItem[]; emptyLabel: string }>({
  name: "slashCommand",

  addOptions() {
    return { getItems: () => [], emptyLabel: "" };
  },

  addProseMirrorPlugins() {
    const { getItems, emptyLabel } = this.options;
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        // Don't open inside code.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterSlashItems(getItems(), query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<MenuHandle, MenuProps> | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props: { ...props, emptyLabel }, editor: props.editor });
              document.body.appendChild(renderer.element);
              place(renderer.element as HTMLElement, props.clientRect?.());
            },
            onUpdate: (props) => {
              renderer?.updateProps({ ...props, emptyLabel });
              if (renderer) place(renderer.element as HTMLElement, props.clientRect?.());
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                renderer?.destroy();
                renderer?.element.remove();
                renderer = null;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              renderer?.destroy();
              renderer?.element.remove();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
