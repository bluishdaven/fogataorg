import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** What a removed story's address shows instead of the story: that it was moderated, and why. */
export function RemovedNotice({ reason, children }: { reason: string; children?: ReactNode }) {
  const t = useTranslations("Moderation");
  return (
    <section
      className="mx-auto flex max-w-[var(--measure)] flex-col gap-3 rounded-2xl border border-border bg-card p-6 sm:p-8"
      data-testid="removed-notice"
    >
      <ShieldAlert className="size-7 text-destructive" aria-hidden />
      <h1 className="font-serif text-3xl font-semibold">{t("removedTitle")}</h1>
      <p className="text-lg">{t("removedReason", { reason })}</p>
      <p className="text-muted-foreground">{t("removedHint")}</p>
      {children}
    </section>
  );
}
