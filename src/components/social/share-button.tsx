"use client";

import { Link2, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
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

const NETWORK_NAMES = {
  whatsapp: "WhatsApp",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  telegram: "Telegram",
} as const;

const TRIGGER =
  "flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent";

// Phones (coarse pointer) get the system share sheet; desktops get the menu of one-tap links.
const COARSE = "(pointer: coarse)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersNativeShare = () => typeof navigator.share === "function" && window.matchMedia(COARSE).matches;

export function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const t = useTranslations("Social");
  const native = useSyncExternalStore(subscribe, prefersNativeShare, () => false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("shareCopied"));
    } catch {
      toast.error(t("shareCopyFailed"));
    }
  };

  if (native) {
    return (
      <button
        type="button"
        className={TRIGGER}
        aria-label={t("share")}
        title={t("share")}
        data-testid="share-button"
        onClick={() => {
          navigator.share({ title, text, url }).catch((error: unknown) => {
            // Closing the sheet rejects with AbortError; anything else falls back to copying.
            if (!(error instanceof DOMException && error.name === "AbortError")) void copy();
          });
        }}
      >
        <Share className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={TRIGGER} aria-label={t("share")} title={t("share")} data-testid="share-button">
          <Share className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-48">
        <DropdownMenuLabel>{t("share")}</DropdownMenuLabel>
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
