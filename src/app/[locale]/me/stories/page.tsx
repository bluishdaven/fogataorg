import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteStory } from "@/app/actions/stories";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { WriteButton } from "@/components/write-button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { listMyStories } from "@/lib/data/my-stories";
import { storyPath } from "@/lib/domain/handle-routes";
import { storyState, type StoryState } from "@/lib/domain/stories";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MyStories");
  return { title: t("title"), robots: { index: false } };
}

export default async function MyStoriesPage() {
  const t = await getTranslations("MyStories");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/me/series" className={buttonVariants({ variant: "outline" })} data-testid="series-link">
            {t("series")}
          </Link>
          <Link href="/write/import" className={buttonVariants({ variant: "outline" })} data-testid="import-link">
            {t("import")}
          </Link>
        </div>
      </div>
      <Suspense fallback={<StoryListSkeleton count={3} />}>
        <MyStories />
      </Suspense>
    </div>
  );
}

const ORDER: StoryState[] = ["draft", "scheduled", "published", "unlisted"];

async function MyStories() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/stories`)}`);
  const [rows, t, format, m] = await Promise.all([
    listMyStories(viewer),
    getTranslations("MyStories"),
    getFormatter(),
    getTranslations("Moderation"),
  ]);
  const now = new Date();
  const stories = rows.map((row) => ({ ...row, state: storyState(row, now) }));

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-border p-8">
        <p className="font-serif text-xl">{t("emptyTitle")}</p>
        <p className="text-muted-foreground">{t("emptyBody")}</p>
        <WriteButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {ORDER.map((state) => {
        const group = stories.filter((story) => story.state === state);
        if (!group.length) return null;
        return (
          <section key={state} aria-labelledby={`group-${state}`}>
            <h2 id={`group-${state}`} className="mb-2 border-b border-border pb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`groups.${state}`)} <span className="font-normal">({group.length})</span>
            </h2>
            <ul className="divide-y divide-border">
              {group.map((story) => {
                const live = state === "published" || state === "unlisted";
                return (
                  <li key={story.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between" data-testid="my-story">
                    <div className="min-w-0">
                      <p className={cn("truncate font-serif text-lg font-semibold", !story.title && "text-muted-foreground italic")} lang={story.language}>
                        {story.title || t("untitled")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {state === "scheduled" && story.publishedAt
                          ? t("scheduledFor", { date: format.dateTime(story.publishedAt, { dateStyle: "medium", timeStyle: "short" }) })
                          : live && story.publishedAt
                            ? t("publishedOn", { date: format.dateTime(story.publishedAt, { dateStyle: "medium" }) })
                            : t("editedOn", { date: format.dateTime(story.updatedAt, { dateStyle: "medium", timeStyle: "short" }) })}
                        {story.pendingChanges ? ` · ${t("unpublishedChanges")}` : ""}
                      </p>
                      {story.moderation && story.moderationReason ? (
                        <p className="text-sm font-medium text-destructive" data-testid="my-story-moderation">
                          {story.moderation === "removed"
                            ? m("myRemoved", { reason: story.moderationReason })
                            : m("myNsfw", { reason: story.moderationReason })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link href={`/write/${story.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        {t("edit")}
                      </Link>
                      {live ? (
                        <NextLink href={storyPath(viewer.username, story.slug)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          {t("view")}
                        </NextLink>
                      ) : null}
                      <form action={deleteStory}>
                        <input type="hidden" name="id" value={story.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <ConfirmSubmit message={t("deleteConfirm")} label={t("delete")} />
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
