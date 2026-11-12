"use client";

import { ChartNoAxesColumn, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmberDrift } from "@/components/ember-drift";
import { FlameLogo } from "@/components/flame-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { SHARE_NETWORKS, shareLink } from "@/lib/domain/share";
import { cn } from "@/lib/utils";

/** sessionStorage key the editor sets right before opening a story it just published for the first time. */
export const JUST_PUBLISHED_KEY = "fogata:just-published";

const NETWORK_NAMES = {
  whatsapp: "WhatsApp",
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  telegram: "Telegram",
} as const;

/**
 * The moment a story goes live: a flame, a burst of sparks and the ways to share it (growth loop 2
 * in the spec: writers bring their own readers). Shown once, to the writer, right after a first
 * publish; under reduced motion the flame simply appears.
 */
export function PublishedMoment({ storyId, url, text }: { storyId: string; url: string; text: string }) {
  const t = useTranslations("Published");
  const social = useTranslations("Social");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(JUST_PUBLISHED_KEY) !== storyId) return;
      window.sessionStorage.removeItem(JUST_PUBLISHED_KEY);
    } catch {
      return;
    }
    // Opening from an effect is the point: this only exists after the editor's navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [storyId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(social("shareCopied"));
    } catch {
      toast.error(social("shareCopyFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent closeLabel={t("close")} className="overflow-hidden sm:max-w-md" data-testid="published-moment">
        <div className="publish-burst relative -mx-6 -mt-6 mb-2 flex h-36 items-end justify-center bg-ember-soft/60 pb-5" aria-hidden>
          <EmberDrift count={8} rise="-110px" />
          <FlameLogo className="publish-flame relative h-20" />
        </div>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription className="text-pretty">{t("body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button type="button" onClick={() => void copy()} data-testid="published-copy">
            <Link2 aria-hidden />
            {social("shareCopy")}
          </Button>
          <ul className="flex flex-wrap gap-2" aria-label={t("networks")}>
            {SHARE_NETWORKS.map((network) => (
              <li key={network}>
                <a
                  href={shareLink(network, url, text)}
                  target={network === "email" ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  data-testid={`published-${network}`}
                >
                  {network === "email" ? social("shareEmail") : NETWORK_NAMES[network]}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground text-pretty">{t("tip")}</p>
          <Link
            href={`/me/stats/${storyId}`}
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-ember-text underline-offset-4 hover:underline"
          >
            <ChartNoAxesColumn className="size-4" aria-hidden />
            {t("stats")}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
