"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { deleteAccount } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmsUsername } from "@/lib/domain/account";

/** Delete account: the username typed back enables the button; the server checks it again. */
export function DeleteAccountForm({ username }: { username: string }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirmsUsername(typed, username);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    // On success the server signs out and redirects home; only failures come back.
    const result = await deleteAccount({ confirm: typed, locale });
    setPending(false);
    if (result && !result.ok) setError(t(`errors.${result.error}`));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="delete-account-form">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-username">{t("deleteConfirmLabel", { username })}</Label>
        <Input
          id="confirm-username"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={error ? "delete-account-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="sm:max-w-xs"
        />
      </div>
      {error ? (
        <p id="delete-account-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="destructive" disabled={!matches || pending} data-testid="delete-account">
          {pending ? t("deleting") : t("deleteButton")}
        </Button>
      </div>
    </form>
  );
}
