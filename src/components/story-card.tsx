import NextLink from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { UserBadges } from "@/components/badges/user-badges";
import { UnsplashImage } from "@/components/unsplash/unsplash-image";
import type { BadgeData } from "@/lib/domain/badges";
import { storyPath } from "@/lib/domain/handle-routes";
import type { Locale } from "@/lib/domain/locale";
import { isUnsplashImageUrl } from "@/lib/domain/unsplash";

export type StoryCardData = {
  title: string;
  subtitle: string;
  slug: string;
  language: Locale;
  readingTime: number;
  publishedAt: Date | null;
  excerpt: string;
  /** Cover, else first image in the story; only URLs from allowed hosts reach here. */
  thumbnail: { url: string; alt: string } | null;
  /** Marked NSFW by moderation: labelled, and never shown with a picture. */
  nsfw?: boolean;
  author: { username: string; displayName: string; avatarUrl?: string | null; pronouns?: string; badges?: BadgeData };
};

export function StoryCard({ story }: { story: StoryCardData }) {
  const t = useTranslations();
  const format = useFormatter();
  const href = storyPath(story.author.username, story.slug);
  const authorName = story.author.displayName || story.author.username;

  return (
    <article className="group relative -mx-3 flex items-start gap-4 rounded-2xl border-b border-border/70 px-3 py-6 transition-colors last:border-b-0 hover:bg-card motion-safe:duration-200 sm:-mx-4 sm:gap-6 sm:px-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar name={authorName} url={story.author.avatarUrl} className="size-6 text-[0.625rem]" />
          <span className="font-medium text-foreground">{authorName}</span>
          <UserBadges badges={story.author.badges} />
          {story.author.pronouns ? <span data-testid="byline-pronouns">{story.author.pronouns}</span> : null}
        </p>
        <h3 className="font-serif text-xl leading-snug font-semibold text-balance sm:text-2xl" lang={story.language}>
          {/* Next's Link (not the i18n one): share URLs have no locale prefix. */}
          <NextLink
            href={href}
            className="after:absolute after:inset-0 after:content-[''] group-hover:text-ember-text focus-visible:outline-none"
          >
            {story.title}
          </NextLink>
        </h3>
        {story.subtitle ? (
          <p className="font-serif text-base text-muted-foreground sm:text-lg" lang={story.language}>
            {story.subtitle}
          </p>
        ) : null}
        {/* A taste of the opening; NSFW stories keep their text behind the warning. */}
        {story.excerpt && !story.nsfw ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.9375rem]" lang={story.language} data-testid="story-preview">
            {story.excerpt}
          </p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span
            className="rounded-full border border-border px-2 py-px text-xs font-semibold tracking-wide"
            title={t("Story.writtenIn", { language: t(`Common.languageName.${story.language}`) })}
          >
            {t(`Common.languageBadge.${story.language}`)}
          </span>
          {story.nsfw ? (
            <span className="rounded-full bg-destructive/10 px-2 py-px text-xs font-semibold text-destructive" data-testid="nsfw-label">
              {t("Moderation.nsfwLabel")}
            </span>
          ) : null}
          {story.publishedAt ? (
            <time dateTime={story.publishedAt.toISOString()}>
              {format.dateTime(story.publishedAt, { dateStyle: "medium" })}
            </time>
          ) : null}
          <span aria-hidden>·</span>
          <span>{t("Common.minRead", { minutes: story.readingTime })}</span>
        </p>
      </div>
      {story.thumbnail ? <Thumbnail url={story.thumbnail.url} /> : null}
    </article>
  );
}

/** Decorative: the title link already names the story, so alt is empty. */
function Thumbnail({ url }: { url: string }) {
  return (
    <div className="relative mt-1 size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-40" data-testid="story-thumbnail">
      {isUnsplashImageUrl(url) ? (
        <UnsplashImage rawUrl={url} alt="" fill sizes="(min-width: 640px) 160px, 80px" className="object-cover" />
      ) : (
        // Uploaded images are already resized and compressed on upload.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}
