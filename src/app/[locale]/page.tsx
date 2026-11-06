import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { HomeHeadline } from "@/components/home-headline";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { getLatestStories } from "@/lib/data/stories";
import { localeAlternates } from "@/lib/domain/seo";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), "/") };
}

export default async function HomePage() {
  const [t, m, locale] = await Promise.all([getTranslations("Home"), getTranslations("Metadata"), getLocale()]);
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Lets search engines show "Fogata" as the site name, with its logo. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${site}/#website`,
              name: "Fogata",
              alternateName: "fogata.org",
              url: `${site}/`,
              description: m("description"),
              inLanguage: locale,
              publisher: { "@id": `${site}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${site}/#organization`,
              name: "Fogata",
              url: `${site}/`,
              logo: `${site}/brand/fogata-flame-1024.png`,
            },
          ],
        }}
      />
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
