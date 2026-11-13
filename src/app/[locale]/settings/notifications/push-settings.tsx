"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isAppleMobile, isStandalone } from "@/components/app/app-shell";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/lib/domain/locale";
import { currentPushSubscription, disablePush, enablePush, pushSupported, refreshPush } from "@/lib/push-client";
import { cn } from "@/lib/utils";

type Availability = "ready" | "ios" | "unsupported" | null;

const noop = () => () => {};

function availability(): Availability {
  if (pushSupported()) {
    // iPhone/iPad Safari has PushManager only once Fogata runs from the Home Screen.
    return "ready";
  }
  return isAppleMobile() && !isStandalone() ? "ios" : "unsupported";
}

/** "Notifications on this device": the browser asks for permission only when it's switched on. */
export function PushSettings() {
  const t = useTranslations("PushSettings");
  const raw = useLocale();
  const locale = isLocale(raw) ? raw : "en";
  const available = useSyncExternalStore(noop, availability, () => null);
  const [state, setState] = useState<"loading" | "on" | "off" | "denied" | "failed">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (available !== "ready") return;
    let cancelled = false;
    void (async () => {
      const subscription = await currentPushSubscription();
      const permission = Notification.permission;
      if (cancelled) return;
      if (permission === "denied") setState("denied");
      else if (subscription && permission === "granted") {
        setState("on");
        // Keep the saved copy current (rotated subscription, a new language).
        void refreshPush(locale);
      } else setState("off");
    })();
    return () => {
      cancelled = true;
    };
  }, [available, locale]);

  if (available === null) return <div className="h-28 animate-pulse rounded-xl bg-muted" aria-hidden />;

  if (available !== "ready") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm" data-testid="push-settings">
        <p>{available === "ios" ? t("ios") : t("unsupported")}</p>
        <Link href="/app" className="self-start font-medium text-ember-text underline underline-offset-4 hover:text-foreground">
          {available === "ios" ? t("iosLink") : t("appLink")}
        </Link>
      </div>
    );
  }

  const on = state === "on";
  const toggle = async () => {
    setBusy(true);
    if (on) {
      await disablePush();
      setState("off");
    } else {
      const result = await enablePush(locale);
      setState(result === "on" ? "on" : result === "denied" ? "denied" : "failed");
    }
    setBusy(false);
  };

  const message = busy ? t("working") : state === "on" ? t("on") : state === "denied" ? t("denied") : state === "failed" ? t("failed") : state === "off" ? t("off") : "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="push-settings">
      <div className="flex items-center justify-between gap-4">
        <span id="push-label" className="font-medium">
          {t("label")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="push-label"
          aria-describedby="push-status"
          disabled={busy || state === "loading" || state === "denied"}
          onClick={() => void toggle()}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            "after:absolute after:-inset-2 after:content-['']",
            on ? "bg-primary" : "bg-muted-foreground/40",
          )}
          data-testid="push-switch"
        >
          <span
            aria-hidden
            className={cn("block size-6 rounded-full bg-background shadow transition-transform motion-reduce:transition-none", on ? "translate-x-5" : "translate-x-0")}
          />
        </button>
      </div>
      <p id="push-status" role="status" className={cn("text-sm", state === "denied" || state === "failed" ? "text-destructive" : "text-muted-foreground")}>
        {message}
      </p>
    </div>
  );
}
