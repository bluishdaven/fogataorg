"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { setEmailFrequency } from "@/app/actions/email";
import { Button } from "@/components/ui/button";
import { EMAIL_FREQUENCIES, type EmailFrequency } from "@/lib/domain/email-settings";
import { cn } from "@/lib/utils";

export function EmailFrequencyForm({ initial }: { initial: EmailFrequency }) {
  const t = useTranslations("EmailSettings");
  const [frequency, setFrequency] = useState<EmailFrequency>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "unauthorized">("idle");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    try {
      const result = await setEmailFrequency({ frequency });
      setStatus(result.ok ? "saved" : result.error === "unauthorized" ? "unauthorized" : "error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">{t("frequency")}</legend>
        {EMAIL_FREQUENCIES.map((option) => (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4",
              frequency === option && "border-primary bg-ember-soft/40",
            )}
          >
            <input
              type="radio"
              name="frequency"
              value={option}
              checked={frequency === option}
              onChange={() => {
                setFrequency(option);
                setStatus("idle");
              }}
              className="mt-1 size-4 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t(option)}</span>
              <span className="text-sm text-muted-foreground">{t(`${option}Hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {status === "saved" ? (
        <p role="status" className="rounded-lg bg-secondary px-4 py-3 text-sm" data-testid="email-settings-saved">
          {t("saved")}
        </p>
      ) : status === "error" || status === "unauthorized" ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {status === "unauthorized" ? t("unauthorized") : t("error")}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={status === "saving"} data-testid="email-settings-save">
          {status === "saving" ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
