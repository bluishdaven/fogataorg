import { getLocale, getTranslations } from "next-intl/server";
import { StoryCard } from "@/components/story-card";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getFollowingStories, getReaderSettings } from "@/lib/data/feeds";
import { getLatestStories } from "@/lib/data/stories";
import { FEEDS, feedQuery, parseFeed } from "@/lib/domain/feeds";
import { welcomePath } from "@/lib/domain/onboarding";
import { cn } from "@/lib/utils";

/**
 * The home page's tabs and stories: Latest (in a signed-in reader's languages) and Following.
 * Reads the session and `?feed=`, so it renders inside <Suspense>; the headline stays static.
 */
export async function HomeFeed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, viewer, locale, t] = await Promise.all([searchParams, getViewer(), getLocale(), getTranslations("Home")]);
  const feed = parseFeed(params.feed);
  const settings = viewer ? await getReaderSettings(viewer) : null;
  const stories =
    feed === "following"
      ? viewer
        ? await getFollowingStories(viewer)
        : null
      : await getLatestStories(20, settings && settings.readingLanguages.length < 2 ? settings.readingLanguages : undefined);

  return (
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
  );
}
