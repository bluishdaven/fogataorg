"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { promptInstall, useInstallState } from "./app-shell";

const DISMISSED_KEY = "fogata:app-invite";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "dismissed";
  } catch {
    return false;
  }
}

const noop = () => () => {};
/** Phones and tablets: where installing matters most (computers only see it when Chrome offers it). */
const touchDevice = () => window.matchMedia("(pointer: coarse)").matches;

/**
 * A small card floating at the bottom of the home page inviting readers to install Fogata, until
 * they install it or close it (remembered on the device). Floating, so nothing on the page moves
 * when it appears.
 */
export function AppInvite() {
  const t = useTranslations("App");
  const state = useInstallState();
  const storedDismissed = useSyncExternalStore(noop, readDismissed, () => true);
  const touch = useSyncExternalStore(noop, touchDevice, () => false);
  const [closed, setClosed] = useState(false);

  if (state === null || state === "installed" || storedDismissed || closed) return null;
  if (state !== "offer" && !touch) return null;

  const dismiss = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "dismissed");
    } catch {
      // It just shows again next visit.
    }
  };

  return (
    <aside
      aria-label={t("invite.label")}
      className="rise-in fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg sm:bottom-6"
      data-testid="app-invite"
    >
      <div className="flex items-start gap-3">
        <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-ember-text" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("invite.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("invite.body")}</p>
          <div className="mt-3">
            {state === "offer" ? (
              <Button size="sm" onClick={() => void promptInstall().then((accepted) => accepted && dismiss())} data-testid="app-invite-install">
                <Download aria-hidden />
                {t("invite.install")}
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/app" data-testid="app-invite-how">
                  {t("invite.how")}
                </Link>
              </Button>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-1 shrink-0" aria-label={t("invite.dismiss")} onClick={dismiss} data-testid="app-invite-dismiss">
          <X aria-hidden />
        </Button>
      </div>
    </aside>
  );
}
