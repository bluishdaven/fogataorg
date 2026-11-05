"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { confirmUnsubscribe } from "@/app/actions/email";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/lib/domain/locale";

export function UnsubscribeForm({ token, locale }: { token: string; locale: Locale }) {
  const t = useTranslations("Unsubscribe");
  const [state, setState] = useState<"idle" | "working" | "done" | "invalid">("idle");

  const confirm = async () => {
    setState("working");
    try {
      const result = await confirmUnsubscribe({ token, locale });
      setState(result.ok ? "done" : "invalid");
    } catch {
      setState("invalid");
    }
  };

  if (state === "done" || state === "invalid") {
    return (
      <div role="status">
        <h1 className="font-serif text-4xl font-semibold">{state === "done" ? t("doneTitle") : t("invalidTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{state === "done" ? t("done") : t("invalid")}</p>
        <Link href="/settings/notifications" className="mt-6 inline-block font-medium text-ember-text underline underline-offset-2">
          {t("settings")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("lede")}</p>
      <Button className="mt-6" onClick={confirm} disabled={state === "working"} data-testid="confirm-unsubscribe">
        {state === "working" ? t("working") : t("confirm")}
      </Button>
    </>
  );
}
