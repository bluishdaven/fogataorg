"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { promptInstall, useInstallState } from "./app-shell";

/** Install Fogata the way this browser allows: its own dialog (Chromium), Safari's steps, or the menu. */
export function InstallPanel() {
  const t = useTranslations("App");
  const state = useInstallState();
  const [justInstalled, setJustInstalled] = useState(false);

  if (state === null) return <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" aria-hidden />;

  if (justInstalled || state === "installed") {
    return (
      <div className="mt-4 flex flex-col gap-3" data-testid="app-installed">
        <p role="status">{justInstalled ? t("installedAfter") : t("installed")}</p>
        <Link href="/settings/notifications" className="self-start text-sm font-medium text-ember-text underline underline-offset-4 hover:text-foreground">
          {t("notifySettings")}
        </Link>
      </div>
    );
  }

  if (state === "offer") {
    return (
      <Button className="mt-4" onClick={() => void promptInstall().then(setJustInstalled)} data-testid="app-install">
        <Download aria-hidden />
        {t("installButton")}
      </Button>
    );
  }

  if (state === "ios") {
    return (
      <div className="mt-4" data-testid="app-ios-steps">
        <h3 className="font-medium">{t("iosTitle")}</h3>
        <ol className="mt-3 flex flex-col gap-3">
          {[
            { Icon: Share, text: t("iosStep1") },
            { Icon: SquarePlus, text: t("iosStep2") },
            { Icon: null, text: t("iosStep3") },
          ].map(({ Icon, text }, index) => (
            <li key={text} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ember-soft text-sm font-semibold text-ember-text">
                {index + 1}
              </span>
              <span className="flex items-center gap-2 pt-0.5">
                {text}
                {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <p className="mt-4" data-testid="app-manual">
      {t("manual")}
    </p>
  );
}
