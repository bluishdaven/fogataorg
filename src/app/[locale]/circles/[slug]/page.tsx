import type { Metadata } from "next";
import NextLink from "next/link";
import { UserBadges } from "@/components/badges/user-badges";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleHeader } from "@/components/circles/circle-header";
import { JoinCircleButton } from "@/components/circles/join-circle-button";
import { SubmitStoryDialog } from "@/components/circles/submit-story-dialog";
import { ShareButton } from "@/components/social/share-button";
import { FollowButton } from "@/components/social/toggle-buttons";
import { StoryCard } from "@/components/story-card";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { getCircle, getCircleViewerState, listSubmittableStories } from "@/lib/data/circles";
import { circleImageFileName, circleShareUrl } from "@/lib/domain/circle-card";
import { profilePath } from "@/lib/domain/handle-routes";
import { OG_SIZE, ogPaths, previewVersion } from "@/lib/domain/og";
import { localeAlternates } from "@/lib/domain/seo";
import { storyImagePrefix } from "@/lib/domain/stories";
import { isUnsplashImageUrl, unsplashShareImageUrl } from "@/lib/domain/unsplash";
import { publicEnv } from "@/lib/env";

type Props = PageProps<"/[locale]/circles/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const circle = await getCircle(slug);
  if (!circle) return {};
  const description = circle.description || undefined;
  // Share previews: the circle's header (Unsplash hotlinked as a JPEG crop, uploads re-encoded by the
  // route), else a card with its name on its accent color.
  const header = circle.header;
  const image =
    header && isUnsplashImageUrl(header.url)
      ? { url: unsplashShareImageUrl(header.url), ...OG_SIZE, alt: header.alt || circle.name }
      : {
          url: ogPaths.circle(circle.slug, previewVersion(circle.name, circle.description, circle.accentColor, header?.url)),
          ...OG_SIZE,
          alt: header?.alt || circle.name,
        };
  return {
    title: circle.name,
    description,
    alternates: localeAlternates(await getLocale(), `/circles/${circle.slug}`),
    robots: circle.stories.length ? undefined : { index: false, follow: true },
    openGraph: { type: "website", siteName: "Fogata", title: circle.name, description, images: [image] },
    twitter: { card: "summary_large_image" },
  };
}

export default function CirclePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Toaster position="bottom-center" />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted" aria-hidden />}>
        <Circle params={params} />
      </Suspense>
    </div>
  );
}

async function Circle({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const circle = await getCircle(slug);
  if (!circle) notFound();
  const locale = await getLocale();
  const [t, card] = await Promise.all([getTranslations("Circles"), getTranslations("ShareCard")]);
  const editors = circle.members.filter((m) => m.role === "owner" || m.role === "editor");
  const shareUrl = circleShareUrl(publicEnv.NEXT_PUBLIC_SITE_URL, circle.slug);
  // Only a header we host goes into the Stories image; Unsplash photos stay hotlinked, never baked in.
  const headerUrl =
    circle.header && !isUnsplashImageUrl(circle.header.url) && circle.header.url.startsWith(storyImagePrefix(publicEnv.NEXT_PUBLIC_SUPABASE_URL))
      ? circle.header.url
      : null;

  return (
    <>
      <CircleHeader
        name={circle.name}
        description={circle.description}
        accentColor={circle.accentColor}
        header={circle.header}
        privateLabel={circle.isPrivate ? t("privateLabel") : null}
        privateNote={circle.isPrivate ? t("privateNote") : null}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={<div className="h-8 w-40 animate-pulse rounded bg-black/10" aria-hidden />}>
            <CircleActions circleId={circle.id} slug={circle.slug} name={circle.name} isPrivate={circle.isPrivate} />
          </Suspense>
          <ShareButton
            appearance="button"
            side="bottom"
            url={shareUrl}
            title={circle.name}
            text={t("shareText", { name: circle.name })}
            fileName={circleImageFileName(circle.slug)}
            image={{
              kind: "circle",
              input: {
                name: circle.name,
                description: circle.description,
                accentColor: circle.accentColor,
                headerUrl,
                eyebrow: card(circle.isPrivate ? "circlePrivateEyebrow" : "circleEyebrow"),
                // A new circle shows who's in it rather than "0 stories".
                stats: circle.stories.length
                  ? card("circleStats", { stories: circle.stories.length, members: circle.members.length })
                  : card("circleMembers", { members: circle.members.length }),
                latestLabel: card("circleLatest"),
                latest: circle.stories.slice(0, 3).map((story) => ({
                  title: story.title,
                  author: story.author.displayName || story.author.username,
                })),
                cta: card("circleCta"),
                url: shareUrl,
                lang: locale,
              },
            }}
          />
        </div>
      </CircleHeader>
      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_14rem]">
        <section aria-labelledby="circle-stories">
          <h2 id="circle-stories" className="border-b border-border pb-3 font-serif text-2xl font-semibold">
            {t("stories")}
          </h2>
          {circle.stories.length === 0 ? (
            <p className="py-8 text-muted-foreground">{t(circle.isPrivate ? "noStoriesPrivate" : "noStories")}</p>
          ) : (
            <div data-testid="circle-stories">
              {circle.stories.map((story) => (
                <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
              ))}
            </div>
          )}
        </section>
        <aside aria-labelledby="circle-editors" className="text-sm">
          <h2 id="circle-editors" className="mb-2 font-semibold text-muted-foreground">
            {t("editors")}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {editors.map((member) => (
              <li key={member.userId}>
                <NextLink href={profilePath(member.username)} className="hover:text-ember-text">
                  {member.displayName}
                </NextLink>{" "}
                <UserBadges badges={member.badges} />{" "}
                <span className="text-xs text-muted-foreground">{t(`roles.${member.role}`)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

async function CircleActions({ circleId, slug, name, isPrivate }: { circleId: string; slug: string; name: string; isPrivate: boolean }) {
  const viewer = await getViewer();
  const [state, t, locale] = await Promise.all([getCircleViewerState(viewer, circleId), getTranslations("Circles"), getLocale()]);
  // Private circles take stories from members only; everyone else asks to join first.
  const canSubmit = Boolean(viewer) && (!isPrivate || state.role !== null);
  const submittable = canSubmit && viewer ? await listSubmittableStories(viewer) : [];
  const canManage = state.role === "owner" || state.role === "editor";
  const loginHref = `/${locale}/login?next=${encodeURIComponent(`/${locale}/circles/${slug}`)}`;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="opacity-90" data-testid="circle-followers">
        {t("followerCount", { count: state.followers })}
      </span>
      <FollowButton
        target="circle"
        id={circleId}
        initialFollowing={state.following}
        signedIn={state.signedIn}
        loginHref={loginHref}
      />
      {canSubmit ? <SubmitStoryDialog circleId={circleId} circleName={name} stories={submittable} /> : null}
      {isPrivate && state.role === null ? (
        <JoinCircleButton
          circleId={circleId}
          circleName={name}
          initialRequest={state.joinRequest}
          signedIn={state.signedIn}
          loginHref={loginHref}
        />
      ) : null}
      {canManage ? (
        <Link href={`/circles/${slug}/manage`} className={buttonVariants({ variant: "secondary", size: "sm" })} data-testid="manage-circle">
          {t("manage")}
        </Link>
      ) : null}
    </div>
  );
}
