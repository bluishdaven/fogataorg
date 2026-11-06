import { BookOpen, Headphones, Tv } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BadgeChips } from "@/components/badges/badge-guide";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { FollowButton } from "@/components/social/toggle-buttons";
import { getViewer } from "@/lib/auth";
import { getFollowState } from "@/lib/data/social";
import { badgeData } from "@/lib/domain/badges";
import { getProfileWithStories } from "@/lib/data/stories";
import { profilePath } from "@/lib/domain/handle-routes";
import { OG_SIZE, ogPaths, previewVersion } from "@/lib/domain/og";
import { INFLUENCE_KINDS } from "@/lib/domain/profile";
import { safeHref } from "@/lib/domain/story-doc";

type Props = PageProps<"/[locale]/u/[handle]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileWithStories(handle);
  if (!profile) return {};
  const name = profile.displayName || profile.username;
  const t = await getTranslations("Profile");
  const counts =
    profile.storyCount > 0
      ? `${t("storyCount", { count: profile.storyCount })} · ${t("wordCount", { count: profile.wordCount })}`
      : "";
  const description = [profile.bio, counts].filter(Boolean).join(" · ") || undefined;
  // The preview card shows the photo, name, bio and counts; its URL changes when any of them do.
  const version = previewVersion(
    name,
    profile.username,
    profile.pronouns,
    profile.bio,
    profile.avatarUrl,
    profile.storyCount,
    profile.wordCount,
    profile.locale,
  );
  return {
    title: `${name} (@${profile.username})`,
    description,
    alternates: { canonical: profilePath(profile.username) },
    openGraph: {
      type: "profile",
      siteName: "Fogata",
      title: name,
      description,
      url: profilePath(profile.username),
      images: [{ url: ogPaths.profile(profile.username, version), ...OG_SIZE, alt: name }],
    },
    twitter: { card: "summary_large_image" },
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
        <p className="text-muted-foreground">
          @{profile.username}
          {profile.pronouns ? (
            <>
              <span aria-hidden> · </span>
              <span data-testid="profile-pronouns">{profile.pronouns}</span>
            </>
          ) : null}
        </p>
        <BadgeChips badges={badgeData(profile)} name={name} className="mt-1" />
        {profile.bio ? <p className="max-w-prose font-serif text-lg text-pretty">{profile.bio}</p> : null}
        {profile.nowText ? (
          <p className="flex items-start gap-2 text-sm" data-testid="profile-now">
            <NowIcon focus={profile.nowFocus} />
            <span>
              <span className="font-medium">{t("now", { focus: profile.nowFocus })}:</span>{" "}
              <span className="font-serif text-base italic">{profile.nowText}</span>
            </span>
          </p>
        ) : null}
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
          {t("storyCount", { count: profile.storyCount })}
          {profile.storyCount > 0 ? (
            <>
              {" · "}
              <span data-testid="profile-word-count">{t("wordCount", { count: profile.wordCount })}</span>
            </>
          ) : null}
        </p>
        {INFLUENCE_KINDS.some((kind) => profile.influences[kind]?.length) ? (
          <section aria-labelledby="influences-heading" className="mt-2 flex flex-col gap-3" data-testid="profile-influences">
            <h2 id="influences-heading" className="text-sm font-semibold">
              {t("influences")}
            </h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {INFLUENCE_KINDS.map((kind) =>
                profile.influences[kind]?.length ? (
                  <div key={kind} className="flex flex-col gap-1.5">
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t(`influenceKinds.${kind}`)}</dt>
                    <dd>
                      <ul className="flex flex-wrap gap-1.5">
                        {profile.influences[kind].map((item) => (
                          <li key={item} className="rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          </section>
        ) : null}
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

function NowIcon({ focus }: { focus: "reading" | "watching" | "listening" }) {
  const Icon = focus === "watching" ? Tv : focus === "listening" ? Headphones : BookOpen;
  return <Icon className="mt-0.5 size-4 shrink-0 text-ember-text" aria-hidden />;
}
