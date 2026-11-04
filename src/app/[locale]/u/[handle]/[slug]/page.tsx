import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StoryBody } from "@/components/story-body";
import { getStory } from "@/lib/data/stories";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";

type Props = PageProps<"/[locale]/u/[handle]/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params;
  const story = await getStory(handle, slug);
  if (!story) return {};
  const t = await getTranslations("Story");
  const url = storyPath(story.authorUsername, story.slug);
  const description = story.subtitle || story.excerpt;
  return {
    title: story.title,
    description,
    authors: [{ name: story.authorDisplayName || story.authorUsername, url: profilePath(story.authorUsername) }],
    alternates: { canonical: story.canonicalUrl ?? url },
    robots: story.status === "unlisted" ? { index: false } : undefined,
    openGraph: {
      type: "article",
      title: story.title,
      description,
      url,
      locale: story.language === "es" ? "es_MX" : "en_US",
      publishedTime: story.publishedAt?.toISOString(),
      authors: [t("by", { name: story.authorDisplayName || story.authorUsername })],
    },
  };
}

export default function StoryPage({ params }: Props) {
  return (
    <Suspense fallback={<StorySkeleton />}>
      <Story params={params} />
    </Suspense>
  );
}

async function Story({ params }: Pick<Props, "params">) {
  const { handle, slug } = await params;
  const story = await getStory(handle, slug);
  if (!story) notFound();

  const [t, format, locale] = await Promise.all([getTranslations(), getFormatter(), getLocale()]);
  const authorName = story.authorDisplayName || story.authorUsername;

  return (
    <article className="px-4 py-12 sm:py-16" lang={story.language}>
      <header className="mx-auto mb-10 flex max-w-[var(--measure)] flex-col gap-4">
        {story.topics.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs font-medium" lang={locale}>
            {story.topics.map((topic) => (
              <li key={topic.slug} className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                {locale === "es" ? topic.nameEs : topic.nameEn}
              </li>
            ))}
          </ul>
        ) : null}
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance sm:text-title">{story.title}</h1>
        {story.subtitle ? (
          <p className="font-serif text-xl text-muted-foreground text-pretty">{story.subtitle}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" lang={locale}>
          <NextLink href={profilePath(story.authorUsername)} className="font-medium text-foreground hover:text-ember-text">
            {authorName}
          </NextLink>
          {story.publishedAt ? (
            <>
              <span aria-hidden>·</span>
              <time dateTime={story.publishedAt.toISOString()}>
                {format.dateTime(story.publishedAt, { dateStyle: "long" })}
              </time>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{t("Common.minRead", { minutes: story.readingTime })}</span>
          <span aria-hidden>·</span>
          <span title={t("Story.writtenIn", { language: t(`Common.languageName.${story.language}`) })}>
            {t(`Common.languageBadge.${story.language}`)}
          </span>
        </div>
      </header>
      <StoryBody doc={story.content} lang={story.language} />
    </article>
  );
}

function StorySkeleton() {
  return (
    <div aria-hidden className="mx-auto flex max-w-[var(--measure)] flex-col gap-4 px-4 py-16">
      <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-6 w-3/5 animate-pulse rounded bg-muted" />
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-4 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
