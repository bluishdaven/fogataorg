import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StoryBody } from "@/components/story-body";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import { Link } from "@/i18n/navigation";
import { getStory } from "@/lib/data/stories";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { imageCreditSchema, isUnsplashImageUrl, unsplashImageUrl } from "@/lib/domain/unsplash";
import { allowedImagePrefixes, isAllowedStoryImage } from "@/lib/story-images";

function coverImageUrl(url: string, width: number): string {
  return isUnsplashImageUrl(url) ? unsplashImageUrl(url, { width }) : url;
}

type Props = PageProps<"/[locale]/u/[handle]/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params;
  const story = await getStory(handle, slug);
  if (!story) return {};
  const t = await getTranslations("Story");
  const url = storyPath(story.authorUsername, story.slug);
  const description = story.seoDescription || story.subtitle || story.excerpt;
  const cover = story.coverUrl && isAllowedStoryImage(story.coverUrl) ? story.coverUrl : null;
  return {
    title: story.seoTitle || story.title,
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
      images: cover ? [{ url: coverImageUrl(cover, 1200), alt: story.coverAlt }] : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary" },
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
              <li key={topic.slug}>
                <Link
                  href={`/topics/${topic.slug}`}
                  className="block rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground hover:bg-accent"
                >
                  {locale === "es" ? topic.nameEs : topic.nameEn}
                </Link>
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
      {story.coverUrl && isAllowedStoryImage(story.coverUrl) ? (
        <StoryCover url={story.coverUrl} alt={story.coverAlt} credit={story.coverCredit} />
      ) : null}
      <StoryBody doc={story.content} lang={story.language} imagePrefixes={allowedImagePrefixes()} />
    </article>
  );
}

function StoryCover({ url, alt, credit }: { url: string; alt: string; credit: unknown }) {
  const parsedCredit = imageCreditSchema.safeParse(credit);
  return (
    <figure className="mx-auto mb-12 max-w-[1100px]" data-testid="story-cover">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
        {isUnsplashImageUrl(url) ? (
          <UnsplashImage rawUrl={url} alt={alt} fill priority sizes="(min-width: 1100px) 1100px, 100vw" className="object-cover" />
        ) : (
          // Uploaded covers are resized and re-encoded on upload.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="absolute inset-0 size-full object-cover" fetchPriority="high" />
        )}
      </div>
      {parsedCredit.success ? (
        <figcaption className="mt-2 text-center">
          <UnsplashCredit credit={parsedCredit.data} />
        </figcaption>
      ) : null}
    </figure>
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
