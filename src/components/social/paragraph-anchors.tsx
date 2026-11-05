"use client";

import { MessageSquareQuote, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const SHOW_BLOCK_EVENT = "fogata:show-block-responses";
export const RESPOND_TO_BLOCK_EVENT = "fogata:respond-to-block";
const STORY_BODY_ID = "story-body";

type Marker = { blockId: string; top: number; bottom: number; count: number };

/**
 * Paragraph-level conversation: small markers beside paragraphs that have
 * responses, and a "Respond" button when the reader selects text inside a
 * paragraph. Both talk to the responses section through window events.
 */
export function ParagraphAnchors({ counts }: { counts: Record<string, number> }) {
  const t = useTranslations("Social");
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selection, setSelection] = useState<{ blockId: string; top: number; left: number } | null>(null);

  const measure = useCallback(() => {
    const root = document.getElementById(STORY_BODY_ID);
    setContainer(root);
    if (!root) return;
    const rootTop = root.getBoundingClientRect().top;
    setMarkers(
      Object.entries(counts).flatMap(([blockId, count]) => {
        const el = root.querySelector<HTMLElement>(`[data-block="${CSS.escape(blockId)}"]`);
        if (!el) return [];
        const rect = el.getBoundingClientRect();
        return [{ blockId, count, top: rect.top - rootTop, bottom: rect.bottom - rootTop }];
      }),
    );
  }, [counts]);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => measure());
    const root = document.getElementById(STORY_BODY_ID);
    if (root) observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const onSelect = () => {
      const current = window.getSelection();
      const root = document.getElementById(STORY_BODY_ID);
      if (!current || current.isCollapsed || !root || current.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const blockOf = (node: Node | null) =>
        (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-block]") ?? null;
      const start = blockOf(current.anchorNode);
      const end = blockOf(current.focusNode);
      if (!start || start !== end || !root.contains(start) || start.tagName === "FIGURE") {
        setSelection(null);
        return;
      }
      const rect = current.getRangeAt(0).getBoundingClientRect();
      setSelection({ blockId: start.dataset.block!, top: rect.top, left: rect.left + rect.width / 2 });
    };
    document.addEventListener("selectionchange", onSelect);
    window.addEventListener("scroll", () => setSelection(null), { passive: true });
    return () => document.removeEventListener("selectionchange", onSelect);
  }, []);

  return (
    <>
      {container
        ? createPortal(
            <>
              {markers.map((marker) => (
                <button
                  key={marker.blockId}
                  type="button"
                  // Wide screens: in the right margin beside the paragraph. Narrower: in the gap below it.
                  className="absolute top-(--marker-below) right-0 flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-xs after:absolute after:-inset-2 after:content-[''] text-muted-foreground shadow-sm hover:text-foreground lg:top-(--marker-top) lg:translate-x-[calc(100%+0.75rem)]"
                  style={{ "--marker-top": `${marker.top}px`, "--marker-below": `${marker.bottom + 2}px` } as React.CSSProperties}
                  aria-label={t("paragraphResponses", { count: marker.count })}
                  onClick={() => window.dispatchEvent(new CustomEvent(SHOW_BLOCK_EVENT, { detail: marker.blockId }))}
                  data-testid="paragraph-marker"
                >
                  <MessageSquareText className="size-3.5" aria-hidden />
                  {marker.count}
                </button>
              ))}
            </>,
            container,
          )
        : null}
      {selection ? (
        <button
          type="button"
          className="fixed z-40 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 font-sans text-sm text-background shadow-lg"
          style={{ top: selection.top, left: selection.left }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            window.dispatchEvent(new CustomEvent(RESPOND_TO_BLOCK_EVENT, { detail: selection.blockId }));
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
          data-testid="respond-to-selection"
        >
          <MessageSquareQuote className="size-4" aria-hidden />
          {t("respondToParagraph")}
        </button>
      ) : null}
    </>
  );
}
