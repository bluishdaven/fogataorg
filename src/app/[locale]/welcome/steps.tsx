"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { saveLanguages, saveTopics, type OnboardingState } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { LOCALES, type Locale } from "@/lib/domain/locale";
import { MIN_TOPICS } from "@/lib/domain/onboarding";

const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };

const chip =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-input px-4 text-sm transition-colors select-none has-checked:border-primary has-checked:bg-ember-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring sm:min-h-9";

function ErrorMessage({ id, message }: { id: string; message: string | null }) {
  return message ? (
    <p id={id} role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function LanguagesStep({ locale, readingLanguages, next }: { locale: Locale; readingLanguages: Locale[]; next: string | null }) {
  const t = useTranslations("Welcome.languages");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveLanguages, { error: null });
  return (
    <form action={action} className="flex flex-col gap-8">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t("interface")}</legend>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((code) => (
            <label key={code} className={chip} lang={code}>
              <input type="radio" name="locale" value={code} defaultChecked={code === locale} className="sr-only" />
              {LANGUAGE_NAMES[code]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3" aria-describedby={state.error ? "languages-error" : "reading-hint"}>
        <legend className="mb-1 font-medium">{t("reading")}</legend>
        <p id="reading-hint" className="text-sm text-muted-foreground">
          {t("readingHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((code) => (
            <label key={code} className={chip} lang={code}>
              <input type="checkbox" name="readingLanguages" value={code} defaultChecked={readingLanguages.includes(code)} className="sr-only" />
              {LANGUAGE_NAMES[code]}
            </label>
          ))}
        </div>
      </fieldset>
      <ErrorMessage id="languages-error" message={state.error ? t(`errors.${state.error === "readingLanguages" ? "readingLanguages" : "invalid"}`) : null} />
      <div>
        <Button type="submit" size="lg" disabled={pending} data-testid="onboarding-continue">
          {t("continue")}
        </Button>
      </div>
    </form>
  );
}

export function TopicsStep({
  topics,
  chosen,
  locale,
  next,
}: {
  topics: { slug: string; name: string }[];
  chosen: string[];
  locale: Locale;
  next: string | null;
}) {
  const t = useTranslations("Welcome.topics");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveTopics, { error: null });
  const [picked, setPicked] = useState(() => new Set(chosen));
  const toggle = (slug: string, on: boolean) =>
    setPicked((current) => {
      const updated = new Set(current);
      if (on) updated.add(slug);
      else updated.delete(slug);
      return updated;
    });
  const missing = Math.max(0, MIN_TOPICS - picked.size);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <fieldset className="flex flex-col gap-3" aria-describedby="topics-count">
        <legend className="sr-only">{t("legend")}</legend>
        <div className="flex flex-wrap gap-2" data-testid="topic-choices">
          {topics.map((topic) => (
            <label key={topic.slug} className={chip}>
              <input
                type="checkbox"
                name="topics"
                value={topic.slug}
                checked={picked.has(topic.slug)}
                onChange={(event) => toggle(topic.slug, event.target.checked)}
                className="sr-only"
              />
              {topic.name}
            </label>
          ))}
        </div>
      </fieldset>
      <p id="topics-count" className="text-sm text-muted-foreground" aria-live="polite">
        {missing > 0 ? t("needMore", { count: missing }) : t("picked", { count: picked.size })}
      </p>
      <ErrorMessage id="topics-error" message={state.error ? t(`errors.${state.error === "tooFewTopics" ? "tooFewTopics" : "invalid"}`, { min: MIN_TOPICS }) : null} />
      <div>
        <Button type="submit" size="lg" disabled={pending || missing > 0} data-testid="onboarding-continue">
          {t("continue")}
        </Button>
      </div>
    </form>
  );
}
