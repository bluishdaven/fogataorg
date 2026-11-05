"use client";

import { ImageIcon, Link2, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHARE_NETWORKS, shareLink } from "@/lib/domain/share";
import { renderStoryImage, type StoryImageInput } from "./story-image";

const NETWORK_NAMES = {
  whatsapp: "WhatsApp",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  telegram: "Telegram",
} as const;

// Phones (coarse pointer) can hand links and images to the system share sheet.
const COARSE = "(pointer: coarse)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const hasShareSheet = () => typeof navigator.share === "function" && window.matchMedia(COARSE).matches;

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

export function ShareButton({
  url,
  title,
  text,
  image,
  fileName,
}: {
  url: string;
  title: string;
  text: string;
  /** Everything the Stories image shows, with copy in the story's language. */
  image: StoryImageInput;
  fileName: string;
}) {
  const t = useTranslations("Social");
  const shareSheet = useSyncExternalStore(subscribe, hasShareSheet, () => false);
  const rendering = useRef<Promise<Blob> | null>(null);
  const [busy, setBusy] = useState(false);

  // Start drawing as soon as the menu opens: phones only allow sharing shortly after a tap.
  const prepareImage = () => {
    rendering.current ??= renderStoryImage(image).catch((error: unknown) => {
      rendering.current = null;
      throw error;
    });
    return rendering.current;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("shareCopied"));
    } catch {
      toast.error(t("shareCopyFailed"));
    }
  };

  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await prepareImage();
      const file = new File([blob], fileName, { type: "image/png" });
      if (shareSheet && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return;
        } catch (error) {
          if (isAbort(error)) return;
          // Took too long after the tap, or the app refused: save it instead.
        }
      }
      download(blob, fileName);
      toast.success(t("storyImageSaved"));
    } catch {
      toast.error(t("storyImageFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void prepareImage().catch(() => undefined);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
          aria-label={t("share")}
          title={t("share")}
          aria-busy={busy || undefined}
          data-testid="share-button"
        >
          <Share className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-56">
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
        <DropdownMenuItem onSelect={() => void shareImage()} disabled={busy} data-testid="share-stories">
          <ImageIcon aria-hidden />
          {t("shareStories")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy()} data-testid="share-copy">
          <Link2 aria-hidden />
          {t("shareCopy")}
        </DropdownMenuItem>
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
  );
}
