"use client";

import { Flame, Image as ImageIcon, Link2, MessageSquareQuote, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { removeHighlight, saveHighlight } from "@/app/actions/highlights";
import { locateQuote, passageUrl, QUOTE_MAX, quoteCardFileName } from "@/lib/domain/highlights";
import type { StoryHighlight } from "@/lib/data/highlights";
import { RESPOND_TO_BLOCK_EVENT } from "./paragraph-anchors";
import { renderQuoteImage } from "./quote-image";
import { COARSE, download, hasShareSheet, isAbort, subscribe } from "./share-button";

const STORY_BODY_ID = "story-body";

type Selected = { blockId: string; quote: string; near: number; top: number; bottom: number; left: number };

const isCoarse = () => window.matchMedia(COARSE).matches;
const blockOf = (node: Node | null) =>
  (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-block]") ?? null;

/** A DOM range for `quote` inside a paragraph, found near `near` (offsets can shift after edits). */
function rangeFor(block: HTMLElement, quote: string, near: number): Range | null {
  const passage = locateQuote(block.textContent ?? "", quote, near);
  if (!passage) return null;
  const range = document.createRange();
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let position = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && passage.start < position + length) {
      range.setStart(node, passage.start - position);
      started = true;
    }
    if (started && passage.end <= position + length) {
      range.setEnd(node, passage.end - position);
      return range;
    }
    position += length;
  }
  return null;
}

/** Draws the reader's embers with the CSS Custom Highlight API (no DOM changes; skipped where unsupported). */
function paintEmbers(embers: StoryHighlight[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  const root = document.getElementById(STORY_BODY_ID);
  if (!root) return;
  const ranges = embers.flatMap((ember) => {
    const block = root.querySelector<HTMLElement>(`[data-block="${CSS.escape(ember.blockId)}"]`);
    const range = block ? rangeFor(block, ember.quote, ember.start) : null;
    return range ? [range] : [];
  });
  CSS.highlights.set("ember", new Highlight(...ranges));
}

/**
 * What a reader can do with selected words: keep them as an ember, respond to that paragraph,
 * make a quote card, or copy a link that opens the story at that passage.
 */
export function SelectionToolbar({
  storyId,
  signedIn,
  loginHref,
  initialHighlights,
  share,
}: {
  storyId: string;
  signedIn: boolean;
  loginHref: string;
  initialHighlights: StoryHighlight[];
  /** For quote cards and passage links; the card follows the story's language. */
  share: { url: string; slug: string; title: string; author: string; lang: string; accent: string | null };
}) {
  const t = useTranslations("Social");
  const router = useRouter();
  const coarse = useSyncExternalStore(subscribe, isCoarse, () => false);
  const shareSheet = useSyncExternalStore(subscribe, hasShareSheet, () => false);
  const [embers, setEmbers] = useState(initialHighlights);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    paintEmbers(embers);
    return () => {
      if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete("ember");
    };
  }, [embers]);

  useEffect(() => {
    const onSelect = () => {
      const current = window.getSelection();
      const root = document.getElementById(STORY_BODY_ID);
      if (!current || current.isCollapsed || !root || current.rangeCount === 0) {
        setSelected(null);
        return;
      }
      const range = current.getRangeAt(0);
      const block = blockOf(range.startContainer);
      if (!block || block !== blockOf(range.endContainer) || !root.contains(block) || block.tagName === "FIGURE") {
        setSelected(null);
        return;
      }
      // Text before the selection and the selection itself, as the stored text counts it (no <br>).
      const before = document.createRange();
      before.selectNodeContents(block);
      before.setEnd(range.startContainer, range.startOffset);
      const raw = range.cloneContents().textContent ?? "";
      const quote = raw.trim();
      if (!quote) {
        setSelected(null);
        return;
      }
      const near = (before.cloneContents().textContent ?? "").length + (raw.length - raw.trimStart().length);
      const rect = range.getBoundingClientRect();
      setSelected({ blockId: block.dataset.block!, quote, near, top: rect.top, bottom: rect.bottom, left: rect.left + rect.width / 2 });
    };
    const onScroll = () => setSelected(null);
    document.addEventListener("selectionchange", onSelect);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onSelect);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!selected) return null;
  const existing = embers.find(
    (ember) => ember.blockId === selected.blockId && selected.near < ember.end && selected.near + selected.quote.length > ember.start,
  );
  const link = passageUrl(share.url, selected.blockId, selected.quote);
  const done = () => {
    window.getSelection()?.removeAllRanges();
    setSelected(null);
  };

  const keep = async () => {
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    if (selected.quote.length > QUOTE_MAX) {
      toast.error(t("highlightTooLong", { max: QUOTE_MAX }));
      return;
    }
    const { blockId, quote, near } = selected;
    done();
    const result = await saveHighlight({ storyId, blockId, quote, near });
    if (!result.ok) {
      toast.error(result.error === "rateLimited" ? t("errors.rateLimited") : t("highlightFailed"));
      return;
    }
    setEmbers((list) => [...list.filter((ember) => ember.id !== result.highlight.id), result.highlight]);
    toast.success(t("highlightSaved"));
  };

  const unkeep = async (id: string) => {
    done();
    const result = await removeHighlight({ id });
    if (!result.ok) {
      toast.error(t("highlightFailed"));
      return;
    }
    setEmbers((list) => list.filter((ember) => ember.id !== id));
    toast(t("highlightRemoved"));
  };

  const copyLink = async () => {
    done();
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("passageCopied"));
    } catch {
      toast.error(t("shareCopyFailed"));
    }
  };

  const card = async () => {
    // The passage link goes on the clipboard in this same tap (browsers only allow it during one).
    const linkCopied: Promise<boolean> =
      navigator.clipboard?.writeText(link).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false);
    const quote = selected.quote.length > QUOTE_MAX ? `${selected.quote.slice(0, QUOTE_MAX - 1)}…` : selected.quote;
    done();
    setBusy(true);
    try {
      const blob = await renderQuoteImage({ quote, author: share.author, title: share.title, url: share.url, lang: share.lang, accent: share.accent });
      const file = new File([blob], quoteCardFileName(share.slug), { type: "image/png" });
      if (shareSheet && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: share.title });
          return;
        } catch (error) {
          if (isAbort(error)) return;
        }
      }
      download(blob, file.name);
      toast.success((await linkCopied) ? t("quoteCardSavedLinkCopied") : t("quoteCardSaved"));
    } catch {
      toast.error(t("quoteCardFailed"));
    } finally {
      setBusy(false);
    }
  };

  const button =
    "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap transition-colors hover:bg-background/15 sm:min-h-9";
  return (
    <div
      role="toolbar"
      aria-label={t("selectionActions")}
      className="fixed z-40 flex items-center gap-0.5 rounded-full bg-foreground p-1 font-sans text-background shadow-lg"
      style={{
        // Phones show their own menu above a selection, so ours goes below it there.
        top: coarse ? selected.bottom + 12 : selected.top - 8,
        transform: coarse ? "translateX(-50%)" : "translate(-50%, -100%)",
        left: `clamp(10rem, ${selected.left}px, calc(100vw - 10rem))`,
      }}
      onMouseDown={(event) => event.preventDefault()}
      data-testid="selection-toolbar"
    >
      {existing ? (
        <button type="button" className={button} onClick={() => void unkeep(existing.id)} data-testid="unhighlight-selection">
          <X className="size-4" aria-hidden />
          {t("unhighlight")}
        </button>
      ) : (
        <button type="button" className={button} onClick={() => void keep()} data-testid="highlight-selection">
          <Flame className="size-4" aria-hidden />
          {t("highlight")}
        </button>
      )}
      <button
        type="button"
        className={button}
        onClick={() => {
          window.dispatchEvent(new CustomEvent(RESPOND_TO_BLOCK_EVENT, { detail: selected.blockId }));
          done();
        }}
        data-testid="respond-to-selection"
      >
        <MessageSquareQuote className="size-4" aria-hidden />
        {t("respondToParagraph")}
      </button>
      <button type="button" className={button} onClick={() => void card()} disabled={busy} data-testid="quote-card">
        <ImageIcon className="size-4" aria-hidden />
        <span className="max-sm:sr-only">{t("quoteCard")}</span>
      </button>
      <button type="button" className={button} onClick={() => void copyLink()} data-testid="copy-passage">
        <Link2 className="size-4" aria-hidden />
        <span className="max-sm:sr-only">{t("copyPassage")}</span>
      </button>
    </div>
  );
}
