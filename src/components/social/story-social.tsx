import { MessageCircle } from "lucide-react";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { getStorySocial } from "@/lib/data/social";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { SparkButton } from "./spark-button";
import { FollowButton, SaveButton } from "./toggle-buttons";

/**
 * Per-reader part of a story page: the floating action bar and the author card.
 * Rendered inside <Suspense> so the cached story text never waits on it.
 */
export async function StorySocial({
  storyId,
  author,
  slug,
}: {
  storyId: string;
  author: { id: string; username: string; displayName: string; bio: string };
  slug: string;
}) {
  const viewer = await getViewer();
  const [social, t, locale] = await Promise.all([
    getStorySocial(viewer, storyId, author.id),
    getTranslations("Social"),
    getLocale(),
  ]);
  const loginHref = `/${locale}/login?next=${encodeURIComponent(storyPath(author.username, slug))}`;
  const name = author.displayName || author.username;

  return (
    <>
      <Toaster position="bottom-center" />
      <div
        className="sticky bottom-4 z-20 mx-auto mt-12 flex w-fit items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 shadow-lg backdrop-blur"
        role="group"
        aria-label={t("actions")}
        data-testid="story-actions"
      >
        <SparkButton
          storyId={storyId}
          initialTotal={social.sparkTotal}
          initialMine={social.mine}
          signedIn={social.signedIn}
          isAuthor={social.isAuthor}
          loginHref={loginHref}
        />
        <span className="h-5 w-px bg-border" aria-hidden />
        <a
          href="#responses"
          className="flex h-10 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:bg-accent"
          aria-label={t("responsesLink", { count: social.responseCount })}
        >
          <MessageCircle className="size-5" aria-hidden />
          <span aria-hidden className="tabular-nums">
            {social.responseCount}
          </span>
        </a>
        <span className="h-5 w-px bg-border" aria-hidden />
        <SaveButton storyId={storyId} initialSaved={social.saved} signedIn={social.signedIn} loginHref={loginHref} />
      </div>

      <aside
        className="mx-auto mt-12 flex max-w-[var(--measure)] flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-start sm:justify-between"
        aria-label={t("aboutAuthor")}
      >
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t("writtenBy")}</p>
          <NextLink href={profilePath(author.username)} className="font-serif text-xl font-semibold hover:text-ember-text">
            {name}
          </NextLink>
          <p className="text-sm text-muted-foreground">{t("followers", { count: social.followerCount })}</p>
          {author.bio ? <p className="mt-2 max-w-prose text-sm text-pretty">{author.bio}</p> : null}
        </div>
        {social.isAuthor ? null : (
          <FollowButton
            target="user"
            id={author.id}
            initialFollowing={social.following}
            signedIn={social.signedIn}
            loginHref={loginHref}
          />
        )}
      </aside>
    </>
  );
}
