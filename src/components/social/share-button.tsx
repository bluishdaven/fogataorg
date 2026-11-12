"use client";

import { Code, ImageIcon, Link2, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { embedCode } from "@/lib/domain/embed";
import { SHARE_NETWORKS, shareLink } from "@/lib/domain/share";
import { ShareImageDialog, type ShareImage } from "./share-image-dialog";

export type { ShareImage };

const NETWORK_NAMES = {
  whatsapp: "WhatsApp",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  telegram: "Telegram",
} as const;

// Phones (coarse pointer) can hand links and images to the system share sheet.
export const COARSE = "(pointer: coarse)";
export function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
export const hasShareSheet = () => typeof navigator.share === "function" && window.matchMedia(COARSE).matches;

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export function download(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function ShareButton({
  url,
  title,
  text,
  image,
  fileName,
  allowImage = true,
  appearance = "icon",
  side = "top",
  embedUrl,
}: {
  url: string;
  title: string;
  text: string;
  /** Everything the Stories image shows (story copy follows the story's language). */
  image: ShareImage;
  fileName: string;
  allowImage?: boolean;
  /** A round icon (the story action bar) or a labelled button (circle pages). */
  appearance?: "icon" | "button";
  side?: "top" | "bottom";
  /** Stories: the "Read on Fogata" card for other sites (see /embed). */
  embedUrl?: string;
}) {
  const t = useTranslations("Social");
  const shareSheet = useSyncExternalStore(subscribe, hasShareSheet, () => false);
  const [imageOpen, setImageOpen] = useState(false);

  const copy = async (text = url, done = t("shareCopied")) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error(t("shareCopyFailed"));
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {appearance === "button" ? (
          <Button variant="secondary" size="sm" data-testid="share-button">
            <Share aria-hidden />
            {t("share")}
          </Button>
        ) : (
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
            aria-label={t("share")}
            title={t("share")}
            data-testid="share-button"
          >
            <Share className="size-5" aria-hidden />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={appearance === "button" ? "start" : "end"} side={side} className="min-w-56">
        <DropdownMenuLabel>{t("share")}</DropdownMenuLabel>
        {shareSheet ? (
          <DropdownMenuItem
            onSelect={() => {
              navigator.share({ title, text, url }).catch((error: unknown) => {
                if (!isAbort(error)) void copy();
              });
            }}
            data-testid="share-sheet"
          >
            <Share aria-hidden />
            {t("shareVia")}
          </DropdownMenuItem>
        ) : null}
        {allowImage ? (
          // Opens once the menu has closed, so focus moves into the dialog rather than back to the menu.
          <DropdownMenuItem onSelect={() => requestAnimationFrame(() => setImageOpen(true))} data-testid="share-stories">
            <ImageIcon aria-hidden />
            {t("shareStories")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void copy()} data-testid="share-copy">
          <Link2 aria-hidden />
          {t("shareCopy")}
        </DropdownMenuItem>
        {embedUrl ? (
          <DropdownMenuItem onSelect={() => void copy(embedCode(embedUrl, title), t("embedCopied"))} data-testid="share-embed">
            <Code aria-hidden />
            {t("shareEmbed")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {SHARE_NETWORKS.map((network) => (
          <DropdownMenuItem key={network} asChild>
            <a
              href={shareLink(network, url, text)}
              target={network === "email" ? undefined : "_blank"}
              rel="noopener noreferrer"
              data-testid={`share-${network}`}
            >
              {network === "email" ? t("shareEmail") : NETWORK_NAMES[network]}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
      {allowImage ? (
        <ShareImageDialog
          open={imageOpen}
          onOpenChange={setImageOpen}
          image={image}
          fileName={fileName}
          url={url}
          title={title}
          shareSheet={shareSheet}
        />
      ) : null}
    </>
  );
}
