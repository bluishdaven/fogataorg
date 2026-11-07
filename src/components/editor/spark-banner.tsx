"use client";

import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { detachPrompt } from "@/app/actions/prompts";
import { Button } from "@/components/ui/button";

/** In the editor: "Answering the weekly spark: …", with a way out if the story went elsewhere. */
export function SparkBanner({ storyId, prompt }: { storyId: string; prompt: string }) {
  const t = useTranslations("Spark");
  const [shown, setShown] = useState(true);
  const [pending, startTransition] = useTransition();
  if (!shown) return null;
  return (
    <div className="mx-auto mt-4 flex max-w-[var(--measure)] flex-wrap items-center justify-between gap-2 rounded-lg border border-border border-l-4 border-l-ember bg-card px-4 py-3 text-sm" data-testid="spark-banner">
      <span className="flex items-center gap-2">
        <Flame className="size-4 shrink-0 text-ember-text" aria-hidden />
        {t("banner", { prompt })}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await detachPrompt({ storyId });
            if (result.ok) {
              setShown(false);
              toast(t("detached"));
            }
          })
        }
      >
        {t("detach")}
      </Button>
    </div>
  );
}
