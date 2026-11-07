import { getLocale, getTranslations } from "next-intl/server";
import { StoryCard } from "@/components/story-card";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getBurningStories, getFollowingStories, getForYouStories, getReaderSettings } from "@/lib/data/feeds";
import { getLatestStories } from "@/lib/data/stories";
import { feedQuery, feedsFor, parseFeed, type Feed } from "@/lib/domain/feeds";
import { welcomePath } from "@/lib/domain/onboarding";
import { cn } from "@/lib/utils";

/**
 * The home page's tabs and stories. Reads the session and `?feed=`, so it renders inside
 * <Suspense>; the headline above it stays in the static shell.
 */
export async function HomeFeed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, viewer, locale, t] = await Promise.all([searchParams, getViewer(), getLocale(), getTranslations("Home")]);
  const signedIn = Boolean(viewer);
  const feed = parseFeed(params.feed, signedIn);
  const settings = viewer ? await getReaderSettings(viewer) : null;
  const languages = settings?.readingLanguages ?? ["es", "en"];

  const stories =
    feed === "for-you" && viewer
      ? await getForYouStories(viewer, languages)
      : feed === "following" && viewer
        ? await getFollowingStories(viewer)
        : feed === "burning"
          ? await getBurningStories(languages)
          : await getLatestStories(20);

  return (
    <section aria-labelledby="feed-title" className="max-w-3xl">
      <h2 id="feed-title" className="sr-only">
        {t(`feeds.${feed}`)}
      </h2>
      <nav aria-label={t("feeds.label")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b border-border" data-testid="feed-tabs">
          {feedsFor(signedIn).map((tab) => (
            <li key={tab}>
              <Link
                href={{ pathname: "/", query: feedQuery(tab, signedIn) }}
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

      {feed === "for-you" && settings && !settings.onboarded ? (
        <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm" data-testid="onboarding-nudge">
          {t("feeds.pickTopics")}{" "}
          <a href={welcomePath(`/${locale}`, locale)} className="font-medium text-ember-text underline underline-offset-4">
            {t("feeds.pickTopicsLink")}
          </a>
        </p>
      ) : null}

      {stories.length ? (
        <div data-testid="story-list" data-feed={feed}>
          {stories.map((story) => (
            <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
          ))}
        </div>
      ) : (
        <EmptyFeed feed={feed} />
      )}
    </section>
  );
}

async function EmptyFeed({ feed }: { feed: Feed }) {
  const t = await getTranslations("Home");
  return (
    <div className="py-10 text-muted-foreground" data-testid="feed-empty">
      <p>{feed === "following" ? t("feeds.followingEmpty") : t("empty")}</p>
      {feed === "following" ? (
        <Link href="/topics" className="mt-2 inline-block font-medium text-ember-text underline underline-offset-4">
          {t("feeds.browseTopics")}
        </Link>
      ) : null}
    </div>
  );
}
