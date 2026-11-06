import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { AdminModeration } from "@/components/moderation/admin-moderation";
import { NsfwGate } from "@/components/moderation/nsfw-gate";
import { RemovedNotice } from "@/components/moderation/removed-notice";
import { UserBadges } from "@/components/badges/user-badges";
import { ReaderControls } from "@/components/reader-controls";
import { ReadingProgress } from "@/components/reading-progress";
import { StoryTitleBar } from "@/components/story-title-bar";
import { StoryBody } from "@/components/story-body";
import { StoryResponses } from "@/components/social/story-responses";
import { StorySocial } from "@/components/social/story-social";
import { UnsplashCredit } from "@/components/unsplash/unsplash-credit";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getStory } from "@/lib/data/stories";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { OG_SIZE, ogPaths, previewVersion } from "@/lib/domain/og";
import { imageCreditSchema, isUnsplashImageUrl, unsplashShareImageUrl } from "@/lib/domain/unsplash";
import { allowedImagePrefixes, isAllowedStoryImage } from "@/lib/story-images";

type Props = PageProps<"/[locale]/u/[handle]/[slug]">;

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
  // Share previews (WhatsApp, X, iMessage…) use the cover, else the story's first picture: Unsplash
  // pictures hotlinked as a JPEG crop, uploaded ones re-encoded by /api/og/story. No picture (or
  // NSFW): a card with the title and writer from the same route.
  const picture =
    story.moderation === "nsfw"
      ? null
      : ([story.coverUrl, story.thumbnailUrl].find((url): url is string => !!url && isAllowedStoryImage(url)) ?? null);
  const pictureAlt = picture === story.coverUrl ? story.coverAlt || story.title : story.title;
  const shareImage =
    picture && isUnsplashImageUrl(picture)
      ? { url: unsplashShareImageUrl(picture), ...OG_SIZE, alt: pictureAlt }
      : {
          url: ogPaths.story(
            story.authorUsername,
            story.slug,
            previewVersion(story.title, story.subtitle, authorName, story.readingTime, story.language, picture, story.moderation),
          ),
          ...OG_SIZE,
          alt: picture ? pictureAlt : story.title,
        };
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

  return (
    <article id="story" className="px-4 py-12 sm:py-16" lang={story.language}>
      <ReadingProgress targetId="story" />
      <StoryTitleBar
        headerId="story-header"
        storyId="story"
        title={story.title}
        authorName={authorName}
        avatarUrl={story.authorAvatarUrl}
        lang={story.language}
      />
      <header id="story-header" className="mx-auto mb-10 flex max-w-[var(--measure)] flex-col gap-4">
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
          <ReaderControls />
        </div>
      </header>
      <Suspense fallback={null}>
        <AdminModeration storyId={story.id} status={story.moderation} reason={story.moderationReason} />
      </Suspense>
      {(() => {
        const content = (
          <>
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
      <Suspense fallback={<div className="mx-auto mt-12 h-12 w-56 animate-pulse rounded-full bg-muted" aria-hidden />}>
        <StorySocial
          storyId={story.id}
          title={story.title}
          nsfw={nsfw}
          language={story.language}
          readingTime={story.readingTime}
          preview={excerpt(story.contentText, 300)}
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
