"use client";

import { EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Holds an NSFW story (cover and text) behind a content warning that states the moderator's reason.
 * The story stays in the page, hidden and inert, until the reader chooses to see it.
 */
export function NsfwGate({ reason, children }: { reason: string; children: ReactNode }) {
  const t = useTranslations("Moderation");
  const [shown, setShown] = useState(false);
  return (
    <>
      {shown ? null : (
        <div
          className="mx-auto mb-12 flex max-w-[var(--measure)] flex-col items-start gap-3 rounded-2xl border border-border bg-card p-6"
          role="region"
          aria-label={t("nsfwTitle")}
          data-testid="nsfw-gate"
        >
          <p className="flex items-center gap-2 font-semibold">
            <EyeOff className="size-5 text-destructive" aria-hidden />
            {t("nsfwTitle")}
          </p>
          <p className="text-muted-foreground">{t("nsfwReason", { reason })}</p>
          <Button type="button" variant="outline" onClick={() => setShown(true)} data-testid="nsfw-show">
            {t("nsfwShow")}
          </Button>
        </div>
      )}
      <div hidden={!shown} inert={!shown} data-testid="nsfw-content">
        {children}
      </div>
    </>
  );
}
