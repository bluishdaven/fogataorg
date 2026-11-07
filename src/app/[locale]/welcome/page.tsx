import type { Metadata } from "next";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { finishOnboarding } from "@/app/actions/onboarding";
import { Avatar } from "@/components/avatar";
import { UserBadges } from "@/components/badges/user-badges";
import { FollowButton } from "@/components/social/toggle-buttons";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getOnboardingState, getSuggestedWriters } from "@/lib/data/onboarding";
import { listTopicsWithCounts } from "@/lib/data/stories";
import { profilePath } from "@/lib/domain/handle-routes";
import { ONBOARDING_STEPS, parseStep } from "@/lib/domain/onboarding";
import { safeNextPath } from "@/lib/domain/redirect";
import { LanguagesStep, TopicsStep } from "./steps";

type Props = PageProps<"/[locale]/welcome">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Welcome");
  return { title: t("title"), robots: { index: false } };
}

export default function WelcomePage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Suspense fallback={<WelcomeSkeleton />}>
        <Welcome searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function WelcomeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function Welcome({ searchParams }: Pick<Props, "searchParams">) {
  const [params, viewer, locale, t] = await Promise.all([searchParams, getViewer(), getLocale(), getTranslations("Welcome")]);
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/welcome`)}`);
  const step = parseStep(params.step);
  const next = safeNextPath(params.next, "") || null;
  const state = await getOnboardingState(viewer);
  const index = ONBOARDING_STEPS.indexOf(step);
  const back = index > 0 ? ONBOARDING_STEPS[index - 1] : null;
  const query = (target: string) => ({ step: target, ...(next ? { next } : {}) });

  return (
    <div className="flex flex-col gap-8" data-testid="welcome" data-step={step}>
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ember-text">{t("progress", { step: index + 1, total: ONBOARDING_STEPS.length })}</p>
        <h1 className="font-serif text-3xl font-semibold text-balance sm:text-4xl">{t(`${step}.title`)}</h1>
        <p className="text-lg text-muted-foreground text-pretty">{t(`${step}.lede`)}</p>
      </header>

      {step === "languages" ? (
        <LanguagesStep locale={state.locale === locale ? state.locale : locale} readingLanguages={state.readingLanguages} next={next} />
      ) : step === "topics" ? (
        <TopicsStep
          topics={(await listTopicsWithCounts())
            .map((topic) => ({ slug: topic.slug, name: locale === "es" ? topic.nameEs : topic.nameEn }))
            .sort((a, b) => a.name.localeCompare(b.name, locale))}
          chosen={state.topics}
          locale={locale}
          next={next}
        />
      ) : (
        <WritersStep viewerTopics={state.topics} languages={state.readingLanguages} locale={locale} next={next} />
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        {back ? (
          <Link href={{ pathname: "/welcome", query: query(back) }} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("back")}
          </Link>
        ) : (
          <span />
        )}
        <form action={finishOnboarding}>
          <input type="hidden" name="locale" value={locale} />
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Button type="submit" variant="ghost" data-testid="onboarding-skip">
            {t("skip")}
          </Button>
        </form>
      </footer>
    </div>
  );
}

async function WritersStep({
  viewerTopics,
  languages,
  locale,
  next,
}: {
  viewerTopics: string[];
  languages: ("en" | "es")[];
  locale: string;
  next: string | null;
}) {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("Welcome")]);
  if (!viewer) return null;
  const writers = await getSuggestedWriters(viewer, viewerTopics, languages);

  return (
    <div className="flex flex-col gap-6">
      {writers.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border" data-testid="suggested-writers">
          {writers.map((writer) => (
            <li key={writer.id} className="flex items-start gap-3 p-4">
              <Avatar name={writer.displayName} url={writer.avatarUrl} className="size-11 text-sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-1.5">
                  <NextLink href={profilePath(writer.username)} className="font-medium hover:text-ember-text">
                    {writer.displayName}
                  </NextLink>
                  <UserBadges badges={writer.badges} />
                  {writer.newVoice ? (
                    <span className="rounded-full bg-ember-soft px-2 py-0.5 text-xs text-foreground">{t("writers.newVoice")}</span>
                  ) : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  @{writer.username}
                  {writer.pronouns ? ` · ${writer.pronouns}` : ""}
                </span>
                {writer.bio ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{writer.bio}</p> : null}
              </div>
              <FollowButton target="user" id={writer.id} initialFollowing={false} signedIn loginHref={`/${locale}/login`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("writers.none")}</p>
      )}
      <form action={finishOnboarding}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="landing" value="following" />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Button type="submit" size="lg" data-testid="onboarding-done">
          {t("writers.done")}
        </Button>
      </form>
    </div>
  );
}
