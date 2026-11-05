"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { grantDonorBadge, removeDonorBadge } from "@/app/actions/donors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GrantDonorForm() {
  const t = useTranslations("Admin");
  const format = useFormatter();
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await grantDonorBadge({ target, note });
      if (result.ok) {
        const date = result.until ? format.dateTime(new Date(result.until), { dateStyle: "medium" }) : "";
        setMessage({ ok: true, text: t("granted", { name: result.name, date }) });
        setTarget("");
        setNote("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: t(`errors.${result.error}`) });
      }
    } catch {
      setMessage({ ok: false, text: t("errors.failed") });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="donor-target">{t("target")}</Label>
        <Input
          id="donor-target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder={t("targetPlaceholder")}
          autoComplete="off"
          required
        />
        <p className="text-sm text-muted-foreground">{t("targetHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="donor-note">{t("note")}</Label>
        <textarea
          id="donor-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          maxLength={500}
          rows={2}
          className="min-h-11 rounded-xl border border-input bg-transparent px-3.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
        />
      </div>
      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}
          data-testid="donor-message"
        >
          {message.text}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || !target.trim()} data-testid="grant-donor">
          {pending ? t("granting") : t("grant")}
        </Button>
      </div>
    </form>
  );
}

export function RemoveDonorButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      data-testid="remove-donor"
      onClick={async () => {
        if (!window.confirm(t("removeConfirm", { name }))) return;
        setPending(true);
        try {
          await removeDonorBadge({ userId });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {t("remove")}
    </Button>
  );
}
