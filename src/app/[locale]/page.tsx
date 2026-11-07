import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { HomeHeadline } from "@/components/home-headline";
import { HomeFeed } from "@/components/home-feed";
import { WeeklySpark } from "@/components/weekly-spark";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { localeAlternates } from "@/lib/domain/seo";
import { publicEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: localeAlternates(await getLocale(), "/") };
}

export default async function HomePage({ searchParams }: PageProps<"/[locale]">) {
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

      <Suspense fallback={null}>
        <WeeklySpark />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <HomeFeed searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="max-w-3xl">
      <div aria-hidden className="flex min-h-11 items-end gap-4 border-b border-border pb-2 sm:min-h-10">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      </div>
      <StoryListSkeleton />
    </div>
  );
}
