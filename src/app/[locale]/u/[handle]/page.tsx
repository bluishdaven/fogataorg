import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { FollowButton } from "@/components/social/toggle-buttons";
import { getViewer } from "@/lib/auth";
import { getFollowState } from "@/lib/data/social";
import { getProfileWithStories } from "@/lib/data/stories";
import { profilePath } from "@/lib/domain/handle-routes";
import { safeHref } from "@/lib/domain/story-doc";

type Props = PageProps<"/[locale]/u/[handle]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileWithStories(handle);
  if (!profile) return {};
  const name = profile.displayName || profile.username;
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || undefined,
    alternates: { canonical: profilePath(profile.username) },
    openGraph: { type: "profile", title: name, description: profile.bio || undefined, url: profilePath(profile.username) },
  };
}

export default function ProfilePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Suspense
        fallback={
          <div aria-hidden>
            <div className="mb-3 h-9 w-56 animate-pulse rounded bg-muted" />
            <div className="mb-10 h-4 w-80 animate-pulse rounded bg-muted" />
            <StoryListSkeleton count={3} />
          </div>
        }
      >
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: Pick<Props, "params">) {
  const { handle } = await params;
  const profile = await getProfileWithStories(handle);
  if (!profile) notFound();

  const [t, format] = await Promise.all([getTranslations("Profile"), getFormatter()]);
  const name = profile.displayName || profile.username;

  return (
    <>
      <header className="mb-8 flex flex-col gap-2 border-b border-border pb-8">
        <Avatar name={name} url={profile.avatarUrl} className="mb-3 size-24 text-3xl ring-4 ring-card shadow-sm sm:size-28" />
        <h1 className="font-serif text-4xl font-semibold">{name}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
        {profile.bio ? <p className="max-w-prose font-serif text-lg text-pretty">{profile.bio}</p> : null}
        {profile.links.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.links.flatMap((link) => {
              const href = safeHref(link.url);
              return href
                ? [
                    <li key={href}>
                      {/* rel="me" lets other sites (e.g. Mastodon) verify the link back to this profile. */}
                      <a href={href} rel="me noopener noreferrer nofollow" target="_blank" className="text-ember-text underline underline-offset-2">
                        {link.label}
                      </a>
                    </li>,
                  ]
                : [];
            })}
          </ul>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("joined", { date: format.dateTime(profile.createdAt, { month: "long", year: "numeric" }) })}
          {" · "}
          {t("storyCount", { count: profile.stories.length })}
        </p>
        <Suspense fallback={<div className="h-11 w-48 animate-pulse rounded-full bg-muted sm:h-9" aria-hidden />}>
          <ProfileFollow userId={profile.id} username={profile.username} />
        </Suspense>
      </header>
      <h2 className="sr-only">{t("stories")}</h2>
      {profile.stories.length === 0 ? (
        <p className="text-muted-foreground">{t("noStories", { name })}</p>
      ) : (
        profile.stories.map((story) => <StoryCard key={story.slug} story={story} />)
      )}
    </>
  );
}

async function ProfileFollow({ userId, username }: { userId: string; username: string }) {
  const viewer = await getViewer();
  const [state, t, locale] = await Promise.all([getFollowState(viewer, { userId }), getTranslations("Social"), getLocale()]);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4">
      <p className="text-sm text-muted-foreground" data-testid="follower-count">
        {t("followers", { count: state.followers })}
        {state.following !== null ? ` · ${t("followingCount", { count: state.following })}` : ""}
      </p>
      {viewer?.id === userId ? null : (
        <FollowButton
          target="user"
          id={userId}
          initialFollowing={state.isFollowing}
          signedIn={state.signedIn}
          loginHref={`/${locale}/login?next=${encodeURIComponent(`/@${username}`)}`}
        />
      )}
    </div>
  );
}
