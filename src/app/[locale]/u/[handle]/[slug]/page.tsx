import { Flame } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { JsonLd } from "@/components/json-ld";
import { AdminModeration } from "@/components/moderation/admin-moderation";
import { NsfwGate } from "@/components/moderation/nsfw-gate";
import { RemovedNotice } from "@/components/moderation/removed-notice";
import { UserBadges } from "@/components/badges/user-badges";
import { ListenMode } from "@/components/listen-mode";
import { ReaderControls } from "@/components/reader-controls";
import { ReadTracker } from "@/components/read-tracker";
import { ReadingProgress } from "@/components/reading-progress";
import { StoryTitleBar } from "@/components/story-title-bar";
import { StoryBody } from "@/components/story-body";
import { StoryContents } from "@/components/story-contents";
import { StorySeriesNav } from "@/components/story-series-nav";
import { StoryResponses } from "@/components/social/story-responses";
import { StorySocial } from "@/components/social/story-social";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getStory } from "@/lib/data/stories";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { drawableImage, PREVIEW_SOURCE_CHARS } from "@/lib/domain/share-image";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { clampText, OG_SIZE, ogPaths, previewVersion } from "@/lib/domain/og";
import { imageCreditSchema, isUnsplashImageUrl, unsplashShareImageUrl } from "@/lib/domain/unsplash";
import { publicEnv } from "@/lib/env";
import { allowedImagePrefixes, isAllowedStoryImage } from "@/lib/story-images";

type Props = PageProps<"/[locale]/u/[handle]/[slug]">;
type LoadedStory = NonNullable<Awaited<ReturnType<typeof getStory>>>;

/**
 * The share image: the cover, else the story's first picture (Unsplash hotlinked as a JPEG crop,
 * uploads re-encoded by /api/og/story); no picture, or NSFW, gets a card with the title and writer.
 */
function storyShareImage(story: LoadedStory) {
  const authorName = story.authorDisplayName || story.authorUsername;
  const picture =
    story.moderation === "nsfw"
      ? null
      : ([story.coverUrl, story.thumbnailUrl].find((url): url is string => !!url && isAllowedStoryImage(url)) ?? null);
  const pictureAlt = picture === story.coverUrl ? story.coverAlt || story.title : story.title;
  if (picture && isUnsplashImageUrl(picture)) return { url: unsplashShareImageUrl(picture), ...OG_SIZE, alt: pictureAlt };
  return {
    url: ogPaths.story(
      story.authorUsername,
      story.slug,
      // The color only joins the version when there is one, so existing previews keep their address.
      previewVersion(story.title, story.subtitle, authorName, story.readingTime, story.language, picture, story.moderation, ...(story.accentColor ? [story.accentColor] : [])),
    ),
    ...OG_SIZE,
    alt: picture ? pictureAlt : story.title,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params;
  const story = await getStory(handle, slug);
  if (!story) return {};
  if (story.moderation === "removed") {
    const m = await getTranslations("Moderation");
    return { title: m("removedTitle"), robots: { index: false } };
  }
  const t = await getTranslations("Story");
  const url = storyPath(story.authorUsername, story.slug);
  const description = story.seoDescription || story.subtitle || story.excerpt;
  const authorName = story.authorDisplayName || story.authorUsername;
  // Share previews (WhatsApp, X, iMessage…).
  const shareImage = storyShareImage(story);
  return {
    title: story.seoTitle || story.title,
    description,
    authors: [{ name: authorName, url: profilePath(story.authorUsername) }],
    alternates: { canonical: story.canonicalUrl ?? url },
    robots: story.status === "unlisted" || story.moderation === "nsfw" ? { index: false } : undefined,
    openGraph: {
      type: "article",
      siteName: "Fogata",
      title: story.title,
      description,
      url,
      locale: story.language === "es" ? "es_MX" : "en_US",
      publishedTime: story.publishedAt?.toISOString(),
      authors: [t("by", { name: authorName })],
      images: [shareImage],
    },
    twitter: { card: "summary_large_image" },
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

  if (story.moderation === "removed") {
    return (
      <div className="px-4 py-12 sm:py-16">
        <RemovedNotice reason={story.moderationReason ?? ""}>
          <Suspense fallback={null}>
            <RemovedAuthorHint authorId={story.authorId} />
          </Suspense>
        </RemovedNotice>
        <Suspense fallback={null}>
          <AdminModeration storyId={story.id} status={story.moderation} reason={story.moderationReason} />
        </Suspense>
      </div>
    );
  }
  const nsfw = story.moderation === "nsfw";
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const absolute = (path: string) => (path.startsWith("http") ? path : `${site}${path}`);
  const description = story.seoDescription || story.subtitle || story.excerpt;

  return (
    <article id="story" className="px-4 py-12 sm:py-16" lang={story.language}>
      {/* Structured data for search results; only for stories meant to be found. */}
      {story.status === "published" && !nsfw ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: clampText(story.seoTitle || story.title, 110),
            description,
            image: [absolute(storyShareImage(story).url)],
            datePublished: story.publishedAt?.toISOString(),
            inLanguage: story.language,
            wordCount: story.wordCount,
            isAccessibleForFree: true,
            copyrightYear: story.publishedAt?.getUTCFullYear(),
            copyrightHolder: { "@type": "Person", name: authorName, url: absolute(profilePath(story.authorUsername)) },
            copyrightNotice: story.publishedAt ? `© ${story.publishedAt.getUTCFullYear()} ${authorName}. All rights reserved.` : undefined,
            keywords: story.topics.map((topic) => (story.language === "es" ? topic.nameEs : topic.nameEn)).join(", ") || undefined,
            mainEntityOfPage: { "@type": "WebPage", "@id": story.canonicalUrl ?? absolute(storyPath(story.authorUsername, story.slug)) },
            author: { "@type": "Person", name: authorName, url: absolute(profilePath(story.authorUsername)) },
            publisher: {
              "@type": "Organization",
              name: "Fogata",
              url: `${site}/`,
              logo: { "@type": "ImageObject", url: `${site}/brand/fogata-flame-1024.png` },
            },
          }}
        />
      ) : null}
      <ReadingProgress targetId="story" color={story.accentColor} />
      <ReadTracker storyId={story.id} targetId="story" />
      <StoryTitleBar
        headerId="story-header"
        storyId="story"
        title={story.title}
        authorName={authorName}
        avatarUrl={story.authorAvatarUrl}
        lang={story.language}
      />
      <header id="story-header" className="mx-auto mb-10 flex max-w-[var(--measure)] flex-col gap-4">
        {story.accentColor ? (
          // The writer's color for this story: a thin line here, and the color of its share images.
          <span aria-hidden className="block h-1.5 w-16 rounded-full" style={{ backgroundColor: story.accentColor }} data-testid="story-accent" />
        ) : null}
        {story.circle ? (
          <Link
            href={`/circles/${story.circle.slug}`}
            className="flex w-fit items-center gap-2 text-sm font-medium hover:underline"
            lang={locale}
            data-testid="story-circle"
          >
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: story.circle.accentColor }} />
            {t("Circles.publishedInChip", { circle: story.circle.name })}
          </Link>
        ) : null}
        {story.promptWeek ? (
          <Link
            href={`/prompts/${story.promptWeek}`}
            className="flex w-fit items-center gap-2 text-sm font-medium text-ember-text hover:underline"
            lang={locale}
            data-testid="story-spark"
          >
            <Flame className="size-4" aria-hidden />
            {t("Spark.chip")}
            <span className="sr-only">: {locale === "es" ? story.promptTextEs : story.promptTextEn}</span>
          </Link>
        ) : null}
        {story.topics.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm font-medium sm:text-xs" lang={locale}>
            {story.topics.map((topic) => (
              <li key={topic.slug}>
                <Link
                  href={`/topics/${topic.slug}`}
                  className="flex min-h-10 items-center rounded-full bg-secondary px-4 text-secondary-foreground transition-colors hover:bg-accent sm:min-h-8 sm:px-3"
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
        <div className="mt-2 flex items-center gap-3 border-y border-border/70 py-4" lang={locale}>
          {/* Same destination as the name link, so it's kept out of the tab order and accessibility tree. */}
          <NextLink href={profilePath(story.authorUsername)} tabIndex={-1} aria-hidden className="shrink-0">
            <Avatar name={authorName} url={story.authorAvatarUrl} className="size-11 text-sm" />
          </NextLink>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <NextLink href={profilePath(story.authorUsername)} className="font-medium text-foreground hover:text-ember-text">
                {authorName}
              </NextLink>
              <UserBadges badges={badgeData({ publishedCount: story.authorPublishedCount, donorActive: story.authorDonorActive })} />
              {story.authorPronouns ? (
                <span className="text-sm text-muted-foreground" data-testid="byline-pronouns">
                  {story.authorPronouns}
                </span>
              ) : null}
            </span>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {story.publishedAt ? (
                <>
                  <time dateTime={story.publishedAt.toISOString()}>
                    {format.dateTime(story.publishedAt, { dateStyle: "medium" })}
                  </time>
                  <span aria-hidden>·</span>
                </>
              ) : null}
              <span>{t("Common.minRead", { minutes: story.readingTime })}</span>
              <span aria-hidden>·</span>
              <span title={t("Story.writtenIn", { language: t(`Common.languageName.${story.language}`) })}>
                {t(`Common.languageBadge.${story.language}`)}
              </span>
            </p>
          </div>
          <ListenMode lang={story.language} />
          <ReaderControls />
        </div>
      </header>
      <Suspense fallback={null}>
        <AdminModeration storyId={story.id} status={story.moderation} reason={story.moderationReason} />
      </Suspense>
      {(() => {
        const content = (
          <>
            <StorySeriesNav seriesId={story.seriesId} handle={story.authorUsername} slug={story.slug} placement="top" locale={locale} />
            <StoryContents doc={story.content} lang={story.language} />
            {story.coverUrl && isAllowedStoryImage(story.coverUrl) ? (
              <StoryCover url={story.coverUrl} alt={story.coverAlt} credit={story.coverCredit} />
            ) : null}
            {/* Positioned so paragraph-response markers can sit beside their paragraph. */}
            <div id="story-body" className="relative mx-auto max-w-[var(--measure)]">
              <StoryBody doc={story.content} lang={story.language} imagePrefixes={allowedImagePrefixes()} />
            </div>
          </>
        );
        return nsfw ? <NsfwGate reason={story.moderationReason ?? ""}>{content}</NsfwGate> : content;
      })()}
      <StorySeriesNav seriesId={story.seriesId} handle={story.authorUsername} slug={story.slug} placement="bottom" locale={locale} />
      {/* The writer owns their work; say so plainly (and in the structured data above). */}
      {story.publishedAt ? (
        <p className="mx-auto mt-10 max-w-[var(--measure)] text-sm text-muted-foreground" lang={locale} data-testid="story-copyright">
          {t("Story.copyright", { year: String(story.publishedAt.getUTCFullYear()), name: authorName })}
        </p>
      ) : null}
      <Suspense fallback={<div className="mx-auto mt-12 h-12 w-56 animate-pulse rounded-full bg-muted" aria-hidden />}>
        <StorySocial
          storyId={story.id}
          title={story.title}
          nsfw={nsfw}
          language={story.language}
          readingTime={story.readingTime}
          preview={excerpt(story.contentText, PREVIEW_SOURCE_CHARS)}
          accent={story.accentColor}
          cover={nsfw ? null : drawableImage(story.coverUrl, story.coverCredit, publicEnv.NEXT_PUBLIC_SUPABASE_URL)}
          slug={story.slug}
          author={{
            id: story.authorId,
            username: story.authorUsername,
            displayName: story.authorDisplayName,
            avatarUrl: story.authorAvatarUrl,
            badges: badgeData({ publishedCount: story.authorPublishedCount, donorActive: story.authorDonorActive }),
            bio: story.authorBio,
            pronouns: story.authorPronouns,
            now: story.authorNowText ? { focus: story.authorNowFocus, text: story.authorNowText } : null,
          }}
        />
      </Suspense>
      <Suspense fallback={<div className="mx-auto mt-12 h-40 max-w-[var(--measure)] animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <StoryResponses
          storyId={story.id}
          storyAuthorId={story.authorId}
          authorUsername={story.authorUsername}
          slug={story.slug}
          content={story.content}
          title={story.title}
          authorName={authorName}
          language={story.language}
          accent={story.accentColor}
          cover={nsfw ? null : drawableImage(story.coverUrl, story.coverCredit, publicEnv.NEXT_PUBLIC_SUPABASE_URL)}
        />
      </Suspense>
    </article>
  );
}

async function RemovedAuthorHint({ authorId }: { authorId: string }) {
  const viewer = await getViewer();
  if (viewer?.id !== authorId) return null;
  const t = await getTranslations("Moderation");
  return (
    <Link href="/me/stories" className="w-fit font-medium text-ember-text underline underline-offset-2">
      {t("removedAuthorHint")}
    </Link>
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
  // At least a screen tall: the story that replaces it almost always is, so the footer starts below
  // the fold instead of jumping down when the text streams in (CLS was 0.24 on phones).
  return (
    <div aria-hidden className="mx-auto flex min-h-dvh max-w-[var(--measure)] flex-col gap-4 px-4 py-16">
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
