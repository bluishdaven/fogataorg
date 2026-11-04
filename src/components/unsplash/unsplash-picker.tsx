"use client";

import { ImagePlus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { trackUnsplashSelection } from "@/app/actions/unsplash";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  UNSPLASH_HOME_URL,
  type UnsplashPhoto,
  type UnsplashSearchError,
  type UnsplashSearchResponse,
} from "@/lib/domain/unsplash";
import { UnsplashImage } from "./unsplash-image";

type Status = "idle" | "loading" | "ready" | UnsplashSearchError;

const DEBOUNCE_MS = 350;

/**
 * Search Unsplash and pick a photo, like Medium's image search. Picking a
 * photo reports the "download" to Unsplash and hands the photo (with what's
 * needed to credit it) to `onSelect`.
 */
export function UnsplashPicker({
  onSelect,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  onSelect: (photo: UnsplashPhoto) => void;
  /** Custom trigger; pass null when opening it from elsewhere (controlled `open`). */
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("Unsplash");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  };

  const pick = (photo: UnsplashPhoto) => {
    void trackUnsplashSelection(photo.id);
    onSelect(photo);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" data-testid="unsplash-trigger">
              <ImagePlus />
              {t("trigger")}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        closeLabel={t("close")}
        className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-3xl"
        data-testid="unsplash-picker"
      >
        {open ? <PickerBody onPick={pick} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onPick }: { onPick: (photo: UnsplashPhoto) => void }) {
  const t = useTranslations("Unsplash");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      inflight.current?.abort();
    },
    [],
  );

  async function runSearch(q: string, nextPage: number) {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setSearch(q);
    setStatus("loading");
    try {
      const params = new URLSearchParams({ q, page: String(nextPage), locale });
      const response = await fetch(`/api/unsplash/search?${params}`, { signal: controller.signal });
      const body = (await response.json()) as UnsplashSearchResponse;
      if ("error" in body) {
        setStatus(body.error);
        return;
      }
      setPhotos((previous) => {
        if (nextPage === 1) return body.photos;
        const seen = new Set(previous.map((p) => p.id));
        return [...previous, ...body.photos.filter((p) => !seen.has(p.id))];
      });
      setPage(nextPage);
      setTotalPages(body.totalPages);
      setStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("upstream");
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    const q = value.trim();
    if (!q) {
      inflight.current?.abort();
      setPhotos([]);
      setSearch("");
      setStatus("idle");
      return;
    }
    timer.current = setTimeout(() => void runSearch(q, 1), DEBOUNCE_MS);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearTimeout(timer.current);
    const q = query.trim();
    if (q) void runSearch(q, 1);
  }

  function pickSuggestion(value: string) {
    clearTimeout(timer.current);
    setQuery(value);
    void runSearch(value, 1);
  }

  const suggestions = t.raw("suggestions") as string[];
  const loading = status === "loading";
  const errorMessage: Partial<Record<Status, string>> = {
    unauthorized: t("signIn"),
    not_configured: t("notConfigured"),
    rate_limited: t("rateLimited"),
    upstream: t("error"),
    invalid: t("error"),
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <form role="search" onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label={t("searchLabel")}
          placeholder={t("placeholder")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="h-11 pl-9 text-base"
          autoFocus
          enterKeyHint="search"
        />
      </form>

      <div className="-mx-4 min-h-48 flex-1 overflow-y-auto px-4" aria-live="polite" aria-busy={loading}>
        {status === "idle" ? (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-muted-foreground">{t("idle")}</p>
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => pickSuggestion(suggestion)}>
                    {suggestion}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage[status] ? (
          <p className="py-6 text-muted-foreground" data-testid="unsplash-message">
            {errorMessage[status]}
          </p>
        ) : null}

        {status === "ready" && photos.length === 0 ? (
          <p className="py-6 text-muted-foreground">{t("empty", { query: search })}</p>
        ) : null}

        {loading && photos.length === 0 ? <GridSkeleton /> : null}

        {photos.length > 0 && !errorMessage[status] ? (
          <>
            <ul className="columns-2 gap-3 sm:columns-3" data-testid="unsplash-results">
              {photos.map((photo) => (
                <li key={photo.id} className="mb-3 break-inside-avoid">
                  <button
                    type="button"
                    onClick={() => onPick(photo)}
                    className="group relative block w-full overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    style={{
                      aspectRatio: `${photo.width} / ${photo.height}`,
                      backgroundColor: photo.color ?? "var(--muted)",
                    }}
                    aria-label={t("usePhoto", { name: photo.author.name, alt: photo.alt || t("untitled") })}
                  >
                    <UnsplashImage
                      rawUrl={photo.rawUrl}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 240px, 45vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-2 pt-6 pb-1.5 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
                      {photo.author.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {page < totalPages ? (
              <div className="flex justify-center py-3">
                <Button type="button" variant="outline" onClick={() => void runSearch(search, page + 1)} disabled={loading}>
                  {loading ? t("loading") : t("loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {t.rich("poweredBy", {
          unsplash: (chunks) => (
            <a href={UNSPLASH_HOME_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {chunks}
            </a>
          ),
        })}
      </p>
    </>
  );
}

function GridSkeleton() {
  const heights = ["h-40", "h-56", "h-32", "h-48", "h-36", "h-52"];
  return (
    <div aria-hidden className="columns-2 gap-3 sm:columns-3">
      {heights.map((height, index) => (
        <div key={index} className={`mb-3 animate-pulse rounded-lg bg-muted ${height}`} />
      ))}
    </div>
  );
}
