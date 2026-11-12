import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Star } from "lucide-react";
import { createDraft } from "@/app/actions/stories";
import { AdminFeature } from "@/components/prompts/admin-feature";
import { StoryCard } from "@/components/story-card";
import { Toaster } from "@/components/ui/sonner";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentPrompt, getPromptPage } from "@/lib/data/prompts";
import { isMonday, promptText } from "@/lib/domain/prompts";

type Props = PageProps<"/[locale]/prompts/[week]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week, locale } = await params;
  const prompt = isMonday(week) ? await getPromptPage(week) : null;
  if (!prompt) return {};
  const t = await getTranslations("Spark");
  return {
    title: `${t("eyebrow")}: ${promptText(prompt, locale)}`,
    description: promptText(prompt, locale),
    robots: prompt.total ? undefined : { index: false, follow: true },
  };
}

export default function PromptPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Toaster position="bottom-center" />
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <PromptContent params={params} />
      </Suspense>
    </div>
  );
}

async function PromptContent({ params }: Pick<Props, "params">) {
  const { week } = await params;
  const prompt = isMonday(week) ? await getPromptPage(week) : null;
  if (!prompt) notFound();
  const [t, locale] = await Promise.all([getTranslations("Spark"), getLocale()]);
  // Only this week's spark takes new entries from here.
  const isCurrent = (await getCurrentPrompt())?.id === prompt.id;

  return (
    <>
      <header className="mb-8 flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-ember-text uppercase">
          {t("eyebrow")} · {t("weekOf", { date: new Date(`${prompt.weekOf}T00:00:00Z`) })}
        </p>
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance">{promptText(prompt, locale)}</h1>
        {isCurrent ? (
          <form action={createDraft}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="promptId" value={prompt.id} />
            <Button type="submit">{t("write")}</Button>
          </form>
        ) : null}
        <Link href="/prompts" className="text-sm text-muted-foreground underline underline-offset-4">
          {t("allSparks")}
        </Link>
      </header>
      {prompt.featured.length ? (
        <section aria-labelledby="featured-title" className="mb-10" data-testid="prompt-featured">
          <h2 id="featured-title" className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wide text-ember-text uppercase">
            <Star className="size-4 fill-current" aria-hidden />
            {t("featuredTitle")}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">{t("featuredLede")}</p>
          <ol className="flex flex-col gap-4">
            {prompt.featured.map((story) => (
              <li key={story.id}>
                <div className="ember-glow rounded-2xl px-3 sm:px-4" data-testid="featured-entry">
                  <StoryCard story={story} />
                </div>
                <Suspense fallback={null}>
                  <AdminFeature promptId={prompt.id} storyId={story.id} featured title={story.title} className="mt-2 mb-0" />
                </Suspense>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {prompt.featured.length ? t("moreEntries", { count: prompt.stories.length }) : t("entries", { count: prompt.total })}
      </h2>
      {prompt.stories.length ? (
        <div data-testid="prompt-entries">
          {prompt.stories.map((story) => (
            <div key={story.id}>
              <StoryCard story={story} />
              <Suspense fallback={null}>
                <AdminFeature promptId={prompt.id} storyId={story.id} featured={false} title={story.title} />
              </Suspense>
            </div>
          ))}
        </div>
      ) : prompt.total ? null : (
        <p className="py-6 text-muted-foreground">{t("noEntries")}</p>
      )}
    </>
  );
}
