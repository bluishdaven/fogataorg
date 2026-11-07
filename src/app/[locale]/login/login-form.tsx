"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { sendMagicLink, signInWithOAuth, type MagicLinkState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/turnstile";
import { Link } from "@/i18n/navigation";

type Props = {
  locale: string;
  next?: string;
  linkError: boolean;
  googleEnabled: boolean;
  /** Cloudflare Turnstile site key; without one there's no person check (local and test builds). */
  turnstileSiteKey?: string;
};

export function LoginForm(props: Props) {
  // Remounting resets the action state ("use a different email").
  const [attempt, setAttempt] = useState(0);
  return <LoginFormInner key={attempt} {...props} onReset={() => setAttempt((n) => n + 1)} />;
}

function LoginFormInner({ locale, next, linkError, googleEnabled, turnstileSiteKey, onReset }: Props & { onReset: () => void }) {
  const t = useTranslations("Auth");
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center" data-testid="magic-link-sent">
        <MailCheck className="size-8 text-ember-text" aria-hidden />
        <h2 className="font-serif text-xl font-semibold">{t("checkEmailTitle")}</h2>
        <p className="text-muted-foreground">{t("checkEmailBody", { email: state.email })}</p>
        <Button variant="link" onClick={onReset}>
          {t("useDifferentEmail")}
        </Button>
      </div>
    );
  }

  const emailError = state.status === "error" && state.field === "email";

  return (
    <div className="flex flex-col gap-5">
      {linkError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">{t("errorTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("errorBody")}</p>
        </div>
      ) : null}

      <form action={formAction} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          defaultValue={state.status === "error" ? state.email : undefined}
          required
          aria-invalid={emailError || undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          className="h-11 text-base"
        />
        {state.status === "error" ? (
          <p id={emailError ? "email-error" : undefined} role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Turnstile siteKey={turnstileSiteKey} locale={locale} resetKey={state} />
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending} aria-disabled={pending}>
          {pending ? t("sending") : t("sendLink")}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithOAuth}>
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="locale" value={locale} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <Button type="submit" variant="outline" size="lg" className="h-11 w-full text-base">
              {t("google")}
            </Button>
          </form>
        </>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {t.rich("terms", {
          terms: (chunks) => (
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
