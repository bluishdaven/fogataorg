import { MessageCircle } from "lucide-react";
import NextLink from "next/link";
import { Avatar } from "@/components/avatar";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { getStorySocial } from "@/lib/data/social";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { storyImageFileName } from "@/lib/domain/story-card";
import { publicEnv } from "@/lib/env";
import { ShareButton } from "./share-button";
import { SparkButton } from "./spark-button";
import { FollowButton, SaveButton } from "./toggle-buttons";

/**
 * Per-reader part of a story page: the floating action bar and the author card.
 * Rendered inside <Suspense> so the cached story text never waits on it.
 */
export async function StorySocial({
  storyId,
  title,
  language,
  readingTime,
  preview,
  author,
  slug,
}: {
  storyId: string;
  title: string;
  language: "en" | "es";
  readingTime: number;
  /** A few sentences from the start of the story, for the Stories image. */
  preview: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string };
  slug: string;
}) {
  const viewer = await getViewer();
  const [social, t, locale, card, common] = await Promise.all([
    getStorySocial(viewer, storyId, author.id),
    getTranslations("Social"),
    getLocale(),
    // The share image speaks the story's language, whoever shares it.
    getTranslations({ locale: language, namespace: "ShareCard" }),
    getTranslations({ locale: language, namespace: "Common" }),
  ]);
  const loginHref = `/${locale}/login?next=${encodeURIComponent(storyPath(author.username, slug))}`;
  const name = author.displayName || author.username;
  const shareUrl = new URL(storyPath(author.username, slug), publicEnv.NEXT_PUBLIC_SITE_URL).toString();

  return (
    <>
      <Toaster position="bottom-center" />
      <div
        className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mx-auto mt-12 flex w-fit items-center gap-1 rounded-full border border-border/70 bg-background/85 px-2 py-1 shadow-xl shadow-black/5 backdrop-blur-md sm:gap-2"
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
          className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
          aria-label={t("responsesLink", { count: social.responseCount })}
        >
          <MessageCircle className="size-5" aria-hidden />
          <span aria-hidden className="tabular-nums">
            {social.responseCount}
          </span>
        </a>
        <span className="h-5 w-px bg-border" aria-hidden />
        <SaveButton storyId={storyId} initialSaved={social.saved} signedIn={social.signedIn} loginHref={loginHref} />
        <span className="h-5 w-px bg-border" aria-hidden />
        <ShareButton
          url={shareUrl}
          title={title}
          text={t("shareText", { title, author: name })}
          fileName={storyImageFileName(slug)}
          image={{
            title,
            author: name,
            avatarUrl: author.avatarUrl,
            preview,
            eyebrow: card("eyebrow"),
            readingLabel: common("minRead", { minutes: readingTime }),
            cta: card("cta"),
            url: shareUrl,
            lang: language,
          }}
        />
      </div>

      <aside
        className="mx-auto mt-12 flex max-w-[var(--measure)] flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"
        aria-label={t("aboutAuthor")}
      >
        <div className="flex min-w-0 gap-4">
          <NextLink href={profilePath(author.username)} tabIndex={-1} aria-hidden className="shrink-0">
            <Avatar name={name} url={author.avatarUrl} className="size-14 text-lg" />
          </NextLink>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("writtenBy")}</p>
            <NextLink href={profilePath(author.username)} className="font-serif text-xl font-semibold hover:text-ember-text">
              {name}
            </NextLink>
            <p className="text-sm text-muted-foreground">{t("followers", { count: social.followerCount })}</p>
            {author.bio ? <p className="mt-2 max-w-prose text-sm text-pretty">{author.bio}</p> : null}
          </div>
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
