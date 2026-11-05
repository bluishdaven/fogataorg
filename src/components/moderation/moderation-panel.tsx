"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { moderateStory } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import { MODERATION_REASON_MAX, type ModerationStatus } from "@/lib/domain/moderation";

export function ModerationPanel({
  storyId,
  status,
  reason,
}: {
  storyId: string;
  status: ModerationStatus | null;
  reason: string | null;
}) {
  const t = useTranslations("Moderation");
  const router = useRouter();
  const [action, setAction] = useState<ModerationStatus | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (next: ModerationStatus | null, why: string) => {
    setPending(true);
    setError(null);
    try {
      const result = await moderateStory({ storyId, status: next, reason: why });
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setAction(null);
      setText("");
      router.refresh();
    } catch {
      setError(t("errors.failed"));
    } finally {
      setPending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!action) return;
    if (!text.trim()) {
      setError(t("errors.reasonRequired"));
      return;
    }
    void run(action, text);
  };

  return (
    <section
      className="mx-auto mb-10 flex max-w-[var(--measure)] flex-col gap-3 rounded-2xl border border-dashed border-border p-4 font-sans text-sm"
      aria-label={t("panelTitle")}
      data-testid="moderation-panel"
    >
      <p className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-semibold">{t("panelTitle")}</span>
        {status && reason ? (
          <span className="text-muted-foreground" data-testid="moderation-current">
            {status === "nsfw" ? t("currentNsfw", { reason }) : t("currentRemoved", { reason })}
          </span>
        ) : null}
      </p>

      {action ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="moderation-reason" className="font-medium">
            {t("reason")}
          </label>
          <textarea
            id="moderation-reason"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("reasonPlaceholder")}
            maxLength={MODERATION_REASON_MAX}
            rows={2}
            autoFocus
            className="min-h-11 rounded-xl border border-input bg-transparent px-3.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending} data-testid="moderation-apply">
              {action === "nsfw" ? t("markNsfw") : t("remove")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAction(null)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status !== "nsfw" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setAction("nsfw")} data-testid="moderation-nsfw">
              {t("markNsfw")}
            </Button>
          ) : null}
          {status !== "removed" ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setAction("removed")} data-testid="moderation-remove">
              {t("remove")}
            </Button>
          ) : null}
          {status ? (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => void run(null, "")} data-testid="moderation-lift">
              {t("lift")}
            </Button>
          ) : null}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
