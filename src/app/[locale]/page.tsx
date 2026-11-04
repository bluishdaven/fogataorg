import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FlameLogo } from "@/components/flame-logo";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { getLatestStories } from "@/lib/data/stories";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="flex flex-col gap-5 py-14 sm:py-20" aria-labelledby="home-title">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ember-text uppercase">
          <FlameLogo className="h-5" animated={false} />
          {t("eyebrow")}
        </p>
        <h1 id="home-title" className="max-w-3xl font-serif text-4xl leading-[1.1] font-semibold text-balance sm:text-display">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{t("lede")}</p>
      </section>

      <section aria-labelledby="latest-title" className="max-w-3xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <h2 id="latest-title" className="font-serif text-2xl font-semibold">
            {t("latest")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("allLanguages")}</p>
        </div>
        <Suspense fallback={<StoryListSkeleton />}>
          <LatestStories empty={t("empty")} />
        </Suspense>
      </section>
    </div>
  );
}

async function LatestStories({ empty }: { empty: string }) {
  const stories = await getLatestStories(20);
  if (stories.length === 0) {
    return <p className="py-10 text-muted-foreground">{empty}</p>;
  }
  return (
    <div data-testid="story-list">
      {stories.map((story) => (
        <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
      ))}
    </div>
  );
}
