import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BadgeChips } from "@/components/badges/badge-guide";
import { JsonLd } from "@/components/json-ld";
import { NowLine } from "@/components/profile/now-line";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { BlockMenu } from "@/components/social/block-menu";
import { FollowButton } from "@/components/social/toggle-buttons";
import { Toaster } from "@/components/ui/sonner";
import { getViewer } from "@/lib/auth";
import { getBlockState } from "@/lib/data/blocks";
import { getFollowState } from "@/lib/data/social";
import { badgeData } from "@/lib/domain/badges";
import { listProfileSeries } from "@/lib/data/series";
import { getProfileWithStories } from "@/lib/data/stories";
import { profilePath, seriesPath } from "@/lib/domain/handle-routes";
import { isAvatarUrl } from "@/lib/domain/avatars";
import { OG_SIZE, ogPaths, previewVersion } from "@/lib/domain/og";
import { publicEnv } from "@/lib/env";
import { INFLUENCE_KINDS } from "@/lib/domain/profile";
import { safeHref } from "@/lib/domain/story-doc";
import { RssLink } from "@/components/rss-link";
import { rssPaths } from "@/lib/domain/rss";

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
    alternates: {
      canonical: profilePath(profile.username),
      types: { "application/rss+xml": [{ url: rssPaths.writer(profile.username), title: name }] },
    },
    // A profile with no stories yet is thin; it becomes findable with the first one.
    robots: profile.storyCount ? undefined : { index: false, follow: true },
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

  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const sameAs = profile.links.flatMap((link) => {
    const href = safeHref(link.url);
    return href && /^https?:/.test(href) ? [href] : [];
  });

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          dateCreated: profile.createdAt.toISOString(),
          mainEntity: {
            "@type": "Person",
            name,
            alternateName: `@${profile.username}`,
            description: profile.bio || undefined,
            image: isAvatarUrl(profile.avatarUrl, publicEnv.NEXT_PUBLIC_SUPABASE_URL) ? profile.avatarUrl : undefined,
            url: `${site}${profilePath(profile.username)}`,
            sameAs: sameAs.length ? sameAs : undefined,
          },
        }}
      />
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
        {profile.nowText ? <NowLine focus={profile.nowFocus} text={profile.nowText} /> : null}
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
              {" · "}
              <RssLink href={rssPaths.writer(profile.username)} name={name} />
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
          <ProfileFollow userId={profile.id} username={profile.username} name={name} />
        </Suspense>
      </header>
      <ProfileSeries handle={profile.username} />
      <h2 className="sr-only">{t("stories")}</h2>
      {profile.stories.length === 0 ? (
        <p className="text-muted-foreground">{t("noStories", { name })}</p>
      ) : (
        profile.stories.map((story) => <StoryCard key={story.slug} story={story} />)
      )}
    </>
  );
}

/** The writer's series (only those with a part readers can see). */
async function ProfileSeries({ handle }: { handle: string }) {
  const list = await listProfileSeries(handle);
  if (!list.length) return null;
  const t = await getTranslations("Series");
  return (
    <section aria-labelledby="series-heading" className="mb-8 flex flex-col gap-3" data-testid="profile-series">
      <h2 id="series-heading" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {t("profileHeading")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.map((item) => (
          <li key={item.slug}>
            <NextLink href={seriesPath(handle, item.slug)} className="flex h-full flex-col rounded-xl border border-border p-4 hover:border-ember">
              <span className="font-serif text-lg font-semibold">{item.title}</span>
              {item.description ? <span className="line-clamp-2 text-sm text-muted-foreground">{item.description}</span> : null}
              <span className="mt-auto pt-2 text-sm text-ember-text">{t("parts", { count: item.parts })}</span>
            </NextLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ProfileFollow({ userId, username, name }: { userId: string; username: string; name: string }) {
  const viewer = await getViewer();
  const own = viewer?.id === userId;
  const [state, t, locale, blocked] = await Promise.all([
    getFollowState(viewer, { userId }),
    getTranslations("Social"),
    getLocale(),
    viewer && !own ? getBlockState(viewer, userId) : null,
  ]);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm text-muted-foreground" data-testid="follower-count">
        {t("followers", { count: state.followers })}
        {state.following !== null ? ` · ${t("followingCount", { count: state.following })}` : ""}
      </p>
      {own ? null : (
        <span className="flex items-center gap-2">
          {blocked ? (
            <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground" data-testid="block-state">
              {blocked === "block" ? t("blockedBadge") : t("mutedBadge")}
            </span>
          ) : null}
          {blocked === "block" ? null : (
            <FollowButton
              target="user"
              id={userId}
              initialFollowing={state.isFollowing}
              signedIn={state.signedIn}
              loginHref={`/${locale}/login?next=${encodeURIComponent(`/@${username}`)}`}
            />
          )}
          {viewer ? <BlockMenu userId={userId} name={name} initialKind={blocked} /> : null}
          <Toaster position="bottom-center" />
        </span>
      )}
    </div>
  );
}
