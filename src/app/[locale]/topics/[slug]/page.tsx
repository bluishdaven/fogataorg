import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { Link } from "@/i18n/navigation";
import { FollowButton } from "@/components/social/toggle-buttons";
import { getViewer } from "@/lib/auth";
import { getFollowState } from "@/lib/data/social";
import { getTopicWithStories } from "@/lib/data/stories";
import { RssLink } from "@/components/rss-link";
import { rssPaths } from "@/lib/domain/rss";
import { localeAlternates } from "@/lib/domain/seo";

type Props = PageProps<"/[locale]/topics/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [topic, locale, t] = await Promise.all([getTopicWithStories(slug), getLocale(), getTranslations("Topics")]);
  if (!topic) return {};
  const name = locale === "es" ? topic.nameEs : topic.nameEn;
  return {
    title: name,
    description: t("topicLede", { name }),
    alternates: {
      ...localeAlternates(locale, `/topics/${topic.slug}`),
      types: { "application/rss+xml": [{ url: rssPaths.topic(topic.slug, locale), title: name }] },
    },
    // An empty topic has nothing to find yet.
    robots: topic.stories.length ? undefined : { index: false, follow: true },
  };
}

export default function TopicPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <Topic params={params} />
      </Suspense>
    </div>
  );
}

async function Topic({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const topic = await getTopicWithStories(slug);
  if (!topic) notFound();
  const [t, locale] = await Promise.all([getTranslations("Topics"), getLocale()]);
  const name = locale === "es" ? topic.nameEs : topic.nameEn;

  return (
    <>
      <Link href="/topics" className="text-sm text-muted-foreground hover:text-foreground">
        {t("all")}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold">{name}</h1>
        <Suspense fallback={<div className="h-8 w-24 animate-pulse rounded bg-muted" aria-hidden />}>
          <TopicFollow topicId={topic.id} slug={topic.slug} />
        </Suspense>
      </div>
      <p className="mt-2 mb-6 flex flex-wrap items-center gap-x-3 border-b border-border pb-6 text-muted-foreground">
        <span>{t("count", { count: topic.stories.length })}</span>
        {topic.stories.length ? <RssLink href={rssPaths.topic(topic.slug, locale)} name={name} /> : null}
      </p>
      {topic.stories.length === 0 ? (
        <p className="text-muted-foreground">{t("empty", { name })}</p>
      ) : (
        <div data-testid="story-list">
          {topic.stories.map((story) => (
            <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
          ))}
        </div>
      )}
    </>
  );
}

async function TopicFollow({ topicId, slug }: { topicId: string; slug: string }) {
  const viewer = await getViewer();
  const [state, locale] = await Promise.all([getFollowState(viewer, { topicId }), getLocale()]);
  return (
    <FollowButton
      target="topic"
      id={topicId}
      initialFollowing={state.isFollowing}
      signedIn={state.signedIn}
      loginHref={`/${locale}/login?next=${encodeURIComponent(`/${locale}/topics/${slug}`)}`}
    />
  );
}
