import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { StoryCard } from "@/components/story-card";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { hiddenPeople } from "@/lib/data/blocks";
import { getFollowingStories, getReaderSettings } from "@/lib/data/feeds";
import { listContinueReading } from "@/lib/data/reading";
import { getLatestStories } from "@/lib/data/stories";
import { FEEDS, feedQuery, parseFeed } from "@/lib/domain/feeds";
import { storyPath } from "@/lib/domain/handle-routes";
import { welcomePath } from "@/lib/domain/onboarding";
import { cn } from "@/lib/utils";

/**
 * The home page's tabs and stories: Latest (in a signed-in reader's languages) and Following,
 * with signed-in readers' unfinished stories above them. Reads the session and `?feed=`, so it
 * renders inside <Suspense>; the headline stays static.
 */
export async function HomeFeed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, viewer, locale, t] = await Promise.all([searchParams, getViewer(), getLocale(), getTranslations("Home")]);
  const feed = parseFeed(params.feed);
  const [settings, unfinished, r, hidden] = await Promise.all([
    viewer ? getReaderSettings(viewer) : null,
    viewer ? listContinueReading(viewer) : [],
    getTranslations("Resume"),
    hiddenPeople(viewer),
  ]);
  const stories =
    feed === "following"
      ? viewer
        ? await getFollowingStories(viewer)
        : null
      : // Latest is cached for everyone: leave out the reader's muted and blocked writers here.
        (await getLatestStories(20, settings && settings.readingLanguages.length < 2 ? settings.readingLanguages : undefined)).filter(
          (story) => !hidden.has(story.authorId),
        );

  return (
    <>
      {unfinished.length ? (
        <section aria-labelledby="continue-title" className="mb-8 max-w-3xl" data-testid="continue-reading">
          <h2 id="continue-title" className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {r("heading")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {unfinished.map((item) => (
              <li key={`${item.authorUsername}/${item.slug}`}>
                <NextLink
                  href={`${storyPath(item.authorUsername, item.slug)}${item.blockId ? `#p-${item.blockId}` : ""}`}
                  className="flex h-full flex-col gap-1 rounded-xl border border-border p-3 hover:border-ember"
                >
                  <span className="line-clamp-2 font-serif font-semibold" lang={item.language}>
                    {item.title}
                  </span>
                  <span className="text-sm text-muted-foreground">{r("by", { name: item.authorDisplayName || item.authorUsername })}</span>
                  <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full bg-ember" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </span>
                    {r("progress", { percent: Math.round(item.progress * 100) })}
                  </span>
                </NextLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="feed-title" className="max-w-3xl">
        <h2 id="feed-title" className="sr-only">
          {t(`feeds.${feed}`)}
        </h2>
        <nav aria-label={t("feeds.label")}>
          <ul className="flex gap-1 border-b border-border" data-testid="feed-tabs">
            {FEEDS.map((tab) => (
              <li key={tab}>
                <Link
                  href={{ pathname: "/", query: feedQuery(tab) }}
                  aria-current={tab === feed ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "-mb-px flex min-h-11 items-center border-b-2 px-3 font-serif text-lg font-semibold transition-colors sm:min-h-10",
                    tab === feed ? "border-ember text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`feeds.${tab}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {feed === "following" && settings && !settings.onboarded ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm" data-testid="onboarding-nudge">
            {t("feeds.pickTopics")}{" "}
            <a href={welcomePath(`/${locale}?feed=following`, locale)} className="font-medium text-ember-text underline underline-offset-4">
              {t("feeds.pickTopicsLink")}
            </a>
          </p>
        ) : null}

        {stories === null ? (
          <div className="py-10 text-muted-foreground" data-testid="feed-empty">
            <p>{t("feeds.signInForFollowing")}</p>
            <a
              href={`/${locale}/login?next=${encodeURIComponent(`/${locale}?feed=following`)}`}
              className="mt-2 inline-block font-medium text-ember-text underline underline-offset-4"
            >
              {t("feeds.signIn")}
            </a>
          </div>
        ) : stories.length ? (
          <div data-testid="story-list" data-feed={feed}>
            {stories.map((story) => (
              <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
            ))}
          </div>
        ) : (
          <div className="py-10 text-muted-foreground" data-testid="feed-empty">
            <p>{feed === "following" ? t("feeds.followingEmpty") : t("empty")}</p>
            {feed === "following" ? (
              <Link href="/topics" className="mt-2 inline-block font-medium text-ember-text underline underline-offset-4">
                {t("feeds.browseTopics")}
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
