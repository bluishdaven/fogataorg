"use client";

import { Pin, Sparkles, Trash2, X } from "lucide-react";
import NextLink from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  deleteResponse,
  postResponse,
  setResponsePinned,
  setResponseSpark,
  type PostedResponse,
} from "@/app/actions/social";
import { Avatar } from "@/components/avatar";
import { UserBadges } from "@/components/badges/user-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ResponseView } from "@/lib/data/social";
import { profilePath } from "@/lib/domain/handle-routes";
import { RESPONSE_MAX, splitMentions } from "@/lib/domain/social";
import { cn, scrollBehavior } from "@/lib/utils";
import { RESPOND_TO_BLOCK_EVENT, SHOW_BLOCK_EVENT } from "./paragraph-anchors";

type Viewer = { id: string; username: string; displayName: string } | null;

function fromPosted(posted: PostedResponse): ResponseView {
  return { ...posted, createdAt: new Date(posted.createdAt), pinned: false, sparks: 0, sparkedByViewer: false, replies: [] };
}

function quote(text: string): string {
  return text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text;
}

export function ResponsesSection({
  storyId,
  storyAuthorId,
  initialResponses,
  blockTexts,
  viewer,
  loginHref,
}: {
  storyId: string;
  storyAuthorId: string;
  initialResponses: ResponseView[];
  blockTexts: Record<string, string>;
  viewer: Viewer;
  loginHref: string;
}) {
  const t = useTranslations("Social");
  const [items, setItems] = useState(initialResponses);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const respond = (event: Event) => {
      const blockId = (event as CustomEvent<string>).detail;
      setAnchor(blockId);
      setFilter(null);
      section.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      setTimeout(() => composer.current?.focus(), 300);
    };
    const show = (event: Event) => {
      setFilter((event as CustomEvent<string>).detail);
      section.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    };
    window.addEventListener(RESPOND_TO_BLOCK_EVENT, respond);
    window.addEventListener(SHOW_BLOCK_EVENT, show);
    return () => {
      window.removeEventListener(RESPOND_TO_BLOCK_EVENT, respond);
      window.removeEventListener(SHOW_BLOCK_EVENT, show);
    };
  }, []);

  const total = items.reduce((sum, item) => sum + 1 + item.replies.length, 0);
  const visible = filter ? items.filter((item) => item.blockId === filter) : items;

  const addResponse = (posted: PostedResponse) => {
    const view = fromPosted(posted);
    setItems((current) =>
      posted.parentId
        ? current.map((item) => (item.id === posted.parentId ? { ...item, replies: [...item.replies, view] } : item))
        : [...current, view],
    );
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const result = await deleteResponse(id);
    if (!result.ok) {
      toast.error(t("genericError"));
      return;
    }
    setItems((current) =>
      current.filter((item) => item.id !== id).map((item) => ({ ...item, replies: item.replies.filter((r) => r.id !== id) })),
    );
  };

  const togglePin = async (item: ResponseView) => {
    const result = await setResponsePinned(item.id, !item.pinned);
    if (!result.ok) {
      toast.error(t("genericError"));
      return;
    }
    setItems((current) =>
      current
        .map((r) => (r.id === item.id ? { ...r, pinned: !item.pinned } : r))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.getTime() - b.createdAt.getTime()),
    );
  };

  return (
    <section
      id="responses"
      ref={section}
      aria-labelledby="responses-heading"
      className="mx-auto mt-12 max-w-[var(--measure)] font-sans"
    >
      <h2 id="responses-heading" className="font-serif text-2xl font-semibold">
        {t("responsesHeading", { count: total })}
      </h2>

      {viewer ? (
        <Composer
          ref={composer}
          storyId={storyId}
          parentId={null}
          blockId={anchor}
          anchorText={anchor ? blockTexts[anchor] : undefined}
          onClearAnchor={() => setAnchor(null)}
          onPosted={(posted) => {
            addResponse(posted);
            setAnchor(null);
          }}
        />
      ) : (
        <div className="mt-4 rounded-2xl bg-secondary p-4">
          <NextLink href={loginHref} className={cn(buttonVariants(), "w-full sm:w-auto")}>
            {t("signInToRespond")}
          </NextLink>
        </div>
      )}

      {filter ? (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm" role="status">
          <span>
            <span className="block text-xs text-muted-foreground">{t("showingParagraph")}</span>
            <span className="font-serif italic">“{quote(blockTexts[filter] ?? "")}”</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setFilter(null)}>
            {t("showAll")}
          </Button>
        </div>
      ) : null}

      {visible.length === 0 && !filter ? <p className="mt-6 text-sm text-muted-foreground">{t("noResponses")}</p> : null}

      <ol className="mt-6 flex flex-col divide-y divide-border" data-testid="responses-list">
        {visible.map((item) => (
          <li key={item.id} className="py-5">
            <ResponseItem
              item={item}
              viewer={viewer}
              storyAuthorId={storyAuthorId}
              anchorText={item.blockId ? blockTexts[item.blockId] : undefined}
              onDelete={remove}
              onTogglePin={togglePin}
              loginHref={loginHref}
            />
            {item.replies.length ? (
              <ol className="mt-4 ml-4 flex flex-col gap-4 border-l-2 border-border pl-4 sm:ml-6">
                {item.replies.map((reply) => (
                  <li key={reply.id}>
                    <ResponseItem
                      item={reply}
                      viewer={viewer}
                      storyAuthorId={storyAuthorId}
                      onDelete={remove}
                      loginHref={loginHref}
                    />
                  </li>
                ))}
              </ol>
            ) : null}
            {viewer ? <ReplyBox storyId={storyId} parentId={item.id} onPosted={addResponse} /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Body({ text }: { text: string }) {
  return (
    <p className="mt-1 text-[0.95rem] leading-relaxed whitespace-pre-line text-pretty">
      {splitMentions(text).map((part, index) =>
        part.type === "mention" ? (
          <NextLink key={index} href={profilePath(part.handle)} className="font-medium text-ember-text hover:underline">
            @{part.handle}
          </NextLink>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

function ResponseItem({
  item,
  viewer,
  storyAuthorId,
  anchorText,
  onDelete,
  onTogglePin,
  loginHref,
}: {
  item: ResponseView;
  viewer: Viewer;
  storyAuthorId: string;
  anchorText?: string;
  onDelete: (id: string) => void;
  onTogglePin?: (item: ResponseView) => void;
  loginHref: string;
}) {
  const t = useTranslations("Social");
  const format = useFormatter();
  const [sparked, setSparked] = useState(item.sparkedByViewer);
  const [count, setCount] = useState(item.sparks);
  const isWriter = item.author.id === storyAuthorId;
  const own = viewer?.id === item.author.id;

  const toggleSpark = async () => {
    if (!viewer) {
      window.location.assign(loginHref);
      return;
    }
    const next = !sparked;
    setSparked(next);
    setCount((c) => c + (next ? 1 : -1));
    const result = await setResponseSpark(item.id, next);
    if (!result.ok) {
      setSparked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <article aria-label={t("responseBy", { name: item.author.displayName })} data-testid="response">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <NextLink href={profilePath(item.author.username)} className="flex min-h-8 items-center gap-2 font-medium hover:text-ember-text">
          <Avatar name={item.author.displayName} url={item.author.avatarUrl} className="size-8 text-[0.7rem]" />
          {item.author.displayName}
        </NextLink>
        <UserBadges badges={item.author.badges} />
        {item.author.pronouns ? (
          <span className="text-xs text-muted-foreground" data-testid="response-pronouns">
            {item.author.pronouns}
          </span>
        ) : null}
        {isWriter ? (
          <span className="rounded-full bg-ember-soft px-2 py-px text-xs font-medium text-ember-text">{t("writerBadge")}</span>
        ) : null}
        {item.pinned ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pin className="size-3" aria-hidden />
            {t("pinned")}
          </span>
        ) : null}
        <time className="text-xs text-muted-foreground" dateTime={item.createdAt.toISOString()}>
          {format.dateTime(item.createdAt, { dateStyle: "medium" })}
        </time>
      </header>
      {anchorText ? (
        <blockquote className="mt-2 border-l-2 border-ember pl-3 font-serif text-sm text-muted-foreground italic">
          “{quote(anchorText)}”
        </blockquote>
      ) : null}
      <Body text={item.body} />
      <div className="mt-2 -ml-2 flex items-center gap-1 text-sm text-muted-foreground sm:text-xs">
        <button
          type="button"
          onClick={() => void toggleSpark()}
          disabled={own}
          aria-pressed={sparked}
          aria-label={t("sparkResponse", { count })}
          className={cn(
            "flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-full px-3 transition-colors hover:bg-accent disabled:opacity-50 sm:min-h-8 sm:min-w-8 sm:px-2",
            sparked && "text-ember-text",
          )}
        >
          <Sparkles className={cn("size-3.5", sparked && "fill-current")} aria-hidden />
          <span aria-hidden>{count}</span>
        </button>
        {onTogglePin && viewer?.id === storyAuthorId ? (
          <button
            type="button"
            onClick={() => onTogglePin(item)}
            className="flex min-h-10 items-center rounded-full px-3 transition-colors hover:bg-accent sm:min-h-8 sm:px-2"
          >
            {item.pinned ? t("unpin") : t("pin")}
          </button>
        ) : null}
        {own ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="flex min-h-10 items-center gap-1 rounded-full px-3 transition-colors hover:bg-accent hover:text-destructive sm:min-h-8 sm:px-2"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t("delete")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ReplyBox({ storyId, parentId, onPosted }: { storyId: string; parentId: string; onPosted: (posted: PostedResponse) => void }) {
  const t = useTranslations("Social");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        {t("reply")}
      </button>
    );
  }
  return (
    <div className="mt-3 ml-4 sm:ml-6">
      <Composer
        storyId={storyId}
        parentId={parentId}
        blockId={null}
        autoFocus
        compact
        onCancel={() => setOpen(false)}
        onPosted={(posted) => {
          onPosted(posted);
          setOpen(false);
        }}
      />
    </div>
  );
}

function Composer({
  ref,
  storyId,
  parentId,
  blockId,
  anchorText,
  onClearAnchor,
  onPosted,
  onCancel,
  autoFocus,
  compact,
}: {
  ref?: React.Ref<HTMLTextAreaElement>;
  storyId: string;
  parentId: string | null;
  blockId: string | null;
  anchorText?: string;
  onClearAnchor?: () => void;
  onPosted: (posted: PostedResponse) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("Social");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const result = await postResponse({ storyId, parentId, blockId, body });
    setPending(false);
    if (result.ok) {
      setBody("");
      onPosted(result.response);
    } else {
      setError(t(`errors.${result.error}`));
    }
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-2", !compact && "mt-4")} data-testid={parentId ? "reply-form" : "response-form"}>
      {anchorText ? (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
          <span>
            <span className="block text-xs text-muted-foreground">{t("respondingTo")}</span>
            <span className="font-serif italic">“{quote(anchorText)}”</span>
          </span>
          <button type="button" onClick={onClearAnchor} aria-label={t("clearParagraph")} className="rounded p-1 hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={parentId ? t("replyPlaceholder") : t("responsePlaceholder")}
        aria-label={parentId ? t("replyLabel") : t("responseLabel")}
        maxLength={RESPONSE_MAX}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        className="field-sizing-content min-h-20 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-ring"
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? t("posting") : parentId ? t("postReply") : t("postResponse")}
        </Button>
      </div>
    </form>
  );
}
