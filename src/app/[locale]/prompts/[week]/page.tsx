import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createDraft } from "@/app/actions/stories";
import { StoryCard } from "@/components/story-card";
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
    robots: prompt.stories.length ? undefined : { index: false, follow: true },
  };
}

export default function PromptPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
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
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("entries", { count: prompt.stories.length })}</h2>
      {prompt.stories.length ? (
        <div data-testid="prompt-entries">
          {prompt.stories.map((story) => (
            <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-muted-foreground">{t("noEntries")}</p>
      )}
    </>
  );
}
