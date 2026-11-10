"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { renderCircleImage, type CircleImageInput, type CircleImageOptions } from "@/components/circles/circle-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PREVIEW_LENGTHS, type PreviewLength } from "@/lib/domain/share-image";
import { cn } from "@/lib/utils";
import { DEFAULT_STORY_IMAGE_OPTIONS, renderStoryImage, type StoryImageInput, type StoryImageOptions } from "./story-image";

/** What the "Image for Stories" shows: a story, or a whole circle. */
export type ShareImage = { kind: "story"; input: StoryImageInput } | { kind: "circle"; input: CircleImageInput };

type Options = StoryImageOptions & CircleImageOptions;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

function download(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Lets whoever shares shape the Stories image before it goes out: include the cover (or circle
 * header), use the story's color, and how much of the opening to show (S/M/L), with a live preview.
 * The image is redrawn when an option changes, so it's ready by the time they tap Share (phones only
 * allow sharing right after a tap). Tapping it also copies the link, for the Story's link sticker.
 */
export function ShareImageDialog({
  open,
  onOpenChange,
  image,
  fileName,
  url,
  title,
  shareSheet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ShareImage;
  fileName: string;
  url: string;
  title: string;
  /** Phones hand the image to the share sheet; computers download it. */
  shareSheet: boolean;
}) {
  const t = useTranslations("Social");
  const [options, setOptions] = useState<Options>({ ...DEFAULT_STORY_IMAGE_OPTIONS, header: true });
  const [done, setDone] = useState<{ key: string; blob: Blob; src: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageRef = useRef(image);
  useEffect(() => {
    imageRef.current = image;
  });

  const key = JSON.stringify(options);
  const rendering = open && done?.key !== key && failed !== key;

  // Redraw shortly after the options settle (tapping S, M, L quickly draws once).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const current = imageRef.current;
      const drawing = current.kind === "story" ? renderStoryImage(current.input, options) : renderCircleImage(current.input, options);
      drawing.then(
        (blob) => {
          if (cancelled) return;
          setDone({ key, blob, src: URL.createObjectURL(blob) });
        },
        () => {
          if (!cancelled) setFailed(key);
        },
      );
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `options` is captured through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  // Each drawing gets its own blob URL; let go of the old one once it's replaced (or on close).
  useEffect(() => () => {
    if (done) URL.revokeObjectURL(done.src);
  }, [done]);

  const send = async () => {
    if (!done || done.key !== key) return;
    setBusy(true);
    // Copy the link in the same tap (browsers only allow clipboard writes during one), started
    // before any await, so it's ready to paste into the Story's link sticker.
    const linkCopied: Promise<boolean> =
      navigator.clipboard?.writeText(url).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false);
    const file = new File([done.blob], fileName, { type: "image/png" });
    try {
      if (shareSheet && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          if (await linkCopied) toast.success(t("storyLinkCopied"));
          onOpenChange(false);
          return;
        } catch (error) {
          if (isAbort(error)) return;
          // The app refused or it took too long after the tap: save it instead.
        }
      }
      download(done.blob, fileName);
      toast.success((await linkCopied) ? t("storyImageSavedLinkCopied") : t("storyImageSaved"));
      onOpenChange(false);
    } catch {
      toast.error(t("storyImageFailed"));
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Options>(name: K, value: Options[K]) => setOptions((current) => ({ ...current, [name]: value }));
  const story = image.kind === "story" ? image.input : null;
  const circle = image.kind === "circle" ? image.input : null;
  const lengthLabel: Record<PreviewLength, string> = { s: t("previewShort"), m: t("previewMedium"), l: t("previewLong") };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="share-image-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("storyImageTitle")}</DialogTitle>
          <DialogDescription>{t("storyImageDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative mx-auto aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-44">
            {done ? (
              // A blob URL drawn in this browser; Next's image optimizer has nothing to do here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={done.src}
                alt={t("storyImagePreviewAlt")}
                className={cn("size-full object-cover transition-opacity", rendering && "opacity-60")}
                data-testid="share-image-preview"
              />
            ) : (
              <div className="size-full animate-pulse bg-muted" aria-hidden />
            )}
            <span className="sr-only" aria-live="polite">
              {rendering ? t("storyImageDrawing") : ""}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4 text-sm">
            {story?.cover ? (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-9">
                <input type="checkbox" checked={options.cover} onChange={(e) => set("cover", e.target.checked)} className="size-4 accent-primary" />
                {t("storyImageCover")}
              </label>
            ) : null}
            {story?.accent ? (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-9">
                <input type="checkbox" checked={options.accent} onChange={(e) => set("accent", e.target.checked)} className="size-4 accent-primary" />
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-4 rounded-full border border-border" style={{ backgroundColor: story.accent }} />
                  {t("storyImageAccent")}
                </span>
              </label>
            ) : null}
            {story?.preview ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 font-medium">{t("storyImagePreview")}</legend>
                <div className="flex gap-2" data-testid="share-image-length">
                  {PREVIEW_LENGTHS.map((length) => (
                    <label
                      key={length}
                      title={lengthLabel[length]}
                      className={cn(
                        "flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border px-3 font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring sm:min-h-9 sm:min-w-9",
                        options.preview === length ? "border-ember bg-ember-soft text-ember-text" : "border-border hover:bg-accent",
                      )}
                    >
                      <input
                        type="radio"
                        name="share-image-length"
                        value={length}
                        checked={options.preview === length}
                        onChange={() => set("preview", length)}
                        aria-label={lengthLabel[length]}
                        className="sr-only"
                      />
                      <span aria-hidden>{length.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {circle?.header ? (
              <label className="flex min-h-11 items-center gap-3 sm:min-h-9">
                <input type="checkbox" checked={options.header} onChange={(e) => set("header", e.target.checked)} className="size-4 accent-primary" />
                {t("storyImageHeader")}
              </label>
            ) : null}
            <Button onClick={() => void send()} disabled={!done || rendering || busy} className="mt-auto" data-testid="share-image-confirm">
              {shareSheet ? <Share aria-hidden /> : <Download aria-hidden />}
              {shareSheet ? t("shareImageButton") : t("downloadImageButton")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
