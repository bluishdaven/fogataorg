"use client";

import { Sparkles, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setSparks } from "@/app/actions/social";
import { MAX_SPARKS } from "@/lib/domain/social";
import { cn } from "@/lib/utils";

/**
 * Sparks: tap up to 50 times. Taps update instantly and are saved as one total
 * shortly after the last tap (and when leaving the page). Failed saves roll back.
 * Readers who sparked can take all their sparks back.
 */
export function SparkButton({
  storyId,
  initialTotal,
  initialMine,
  signedIn,
  isAuthor,
  loginHref,
}: {
  storyId: string;
  initialTotal: number;
  initialMine: number;
  signedIn: boolean;
  isAuthor: boolean;
  loginHref: string;
}) {
  const t = useTranslations("Social");
  const format = useFormatter();
  const router = useRouter();
  const [mine, setMine] = useState(initialMine);
  const [total, setTotal] = useState(initialTotal);
  const [burst, setBurst] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const saved = useRef(initialMine);
  const pending = useRef<number | null>(null);
  const inflight = useRef<Promise<unknown> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);

  const save = async () => {
    clearTimeout(timer.current);
    const value = pending.current;
    if (value === null || value === saved.current) return;
    pending.current = null;
    const request = setSparks({ storyId, count: value });
    inflight.current = request;
    const result = await request;
    if (result.ok) {
      saved.current = value;
    } else {
      setTotal((current) => current - (value - saved.current));
      setMine(saved.current);
      toast.error(t("sparkFailed"));
    }
  };

  const takeBack = async () => {
    clearTimeout(timer.current);
    pending.current = null;
    const given = mine;
    setMine(0);
    setTotal((current) => current - given);
    button.current?.focus();
    // Let a save that's already on its way land first, so it can't undo the undo.
    await inflight.current?.catch(() => undefined);
    const result = await setSparks({ storyId, count: 0 });
    if (result.ok) {
      saved.current = 0;
      setAnnouncement(t("sparksTakenBack"));
    } else {
      setMine(given);
      setTotal((current) => current + given);
      toast.error(t("sparkFailed"));
    }
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Flush pending taps when the reader leaves.
  useEffect(() => {
    const flush = () => void saveRef.current();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const onClick = () => {
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    if (isAuthor || mine >= MAX_SPARKS) return;
    setAnnouncement("");
    const next = mine + 1;
    setMine(next);
    setTotal((current) => current + 1);
    setBurst((n) => n + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), 700);
  };

  const label = isAuthor
    ? t("sparkOwn")
    : mine >= MAX_SPARKS
      ? t("sparkMax", { max: MAX_SPARKS })
      : t("spark");

  return (
    <div className="flex items-center gap-1.5">
      <button
        ref={button}
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-describedby={`spark-count-${storyId}`}
        aria-disabled={isAuthor || undefined}
        title={label}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full transition-colors hover:bg-ember-soft",
          mine > 0 ? "text-ember-text" : "text-muted-foreground",
          isAuthor && "cursor-default opacity-60 hover:bg-transparent",
        )}
        data-testid="spark-button"
      >
        <Sparkles className={cn("size-5", mine > 0 && "fill-current")} aria-hidden />
        {burst > 0 ? (
          <span key={burst} aria-hidden className="spark-burst pointer-events-none absolute inset-0">
            <span className="spark-bubble">+{mine}</span>
          </span>
        ) : null}
      </button>
      <span id={`spark-count-${storyId}`} className="text-sm text-muted-foreground tabular-nums" data-testid="spark-total">
        <span className="sr-only">{t("sparkTotal", { count: total })}</span>
        <span aria-hidden>{format.number(total, { notation: "compact" })}</span>
      </span>
      {mine > 0 && !isAuthor ? (
        <button
          type="button"
          onClick={() => void takeBack()}
          aria-label={t("takeBack")}
          title={t("takeBack")}
          className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:bg-accent hover:text-foreground"
          data-testid="spark-undo"
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {mine > 0 ? t("yourSparks", { count: mine }) : announcement}
      </span>
    </div>
  );
}
