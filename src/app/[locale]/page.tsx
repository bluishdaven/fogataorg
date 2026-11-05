import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HomeHeadline } from "@/components/home-headline";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { getLatestStories } from "@/lib/data/stories";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="flex flex-col gap-5 pt-8 pb-12 sm:pt-12 sm:pb-16" aria-labelledby="home-title">
        <HomeHeadline
          id="home-title"
          headlines={t.raw("headlines") as string[]}
          className="max-w-3xl font-serif text-4xl leading-[1.1] font-semibold text-balance sm:text-display"
        />
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{t("lede")}</p>
      </section>

      <section aria-labelledby="latest-title" className="max-w-3xl">
        <h2 id="latest-title" className="border-b border-border pb-3 font-serif text-2xl font-semibold">
          {t("latest")}
        </h2>
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
