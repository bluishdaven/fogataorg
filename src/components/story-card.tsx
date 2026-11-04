import NextLink from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { storyPath } from "@/lib/domain/handle-routes";
import type { Locale } from "@/lib/domain/locale";

export type StoryCardData = {
  title: string;
  subtitle: string;
  slug: string;
  language: Locale;
  readingTime: number;
  publishedAt: Date | null;
  excerpt: string;
  author: { username: string; displayName: string };
};

export function StoryCard({ story }: { story: StoryCardData }) {
  const t = useTranslations();
  const format = useFormatter();
  const href = storyPath(story.author.username, story.slug);
  const authorName = story.author.displayName || story.author.username;

  return (
    <article className="group relative flex flex-col gap-2 border-b border-border py-6 last:border-b-0">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{authorName}</span>
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
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span
          className="rounded-sm border border-border px-1.5 py-px text-xs font-semibold tracking-wide"
          title={t("Story.writtenIn", { language: t(`Common.languageName.${story.language}`) })}
        >
          {t(`Common.languageBadge.${story.language}`)}
        </span>
        {story.publishedAt ? (
          <time dateTime={story.publishedAt.toISOString()}>
            {format.dateTime(story.publishedAt, { dateStyle: "medium" })}
          </time>
        ) : null}
        <span aria-hidden>·</span>
        <span>{t("Common.minRead", { minutes: story.readingTime })}</span>
      </p>
    </article>
  );
}
