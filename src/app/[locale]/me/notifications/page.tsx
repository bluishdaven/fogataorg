import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MarkNotificationsRead } from "@/components/social/mark-notifications-read";
import { getViewer } from "@/lib/auth";
import { listNotifications } from "@/lib/data/social";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social");
  return { title: t("notifications"), robots: { index: false } };
}

export default async function NotificationsPage() {
  const t = await getTranslations("Social");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-8 font-serif text-4xl font-semibold">{t("notifications")}</h1>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/notifications`)}`);
  const [items, t, format] = await Promise.all([listNotifications(viewer), getTranslations("Social"), getFormatter()]);
  const hasUnread = items.some((item) => item.unread);

  if (!items.length) return <p className="text-muted-foreground">{t("noNotifications")}</p>;

  return (
    <>
      {hasUnread ? <MarkNotificationsRead /> : null}
      <ul className="divide-y divide-border" data-testid="notifications-list">
        {items.map((item) => {
          const actor = item.actor?.name ?? t("someone");
          const title = item.story?.title ?? "";
          const message =
            item.type === "follow"
              ? t("notice.follow", { actor, others: item.others })
              : item.type === "spark" && item.responseExcerpt
                ? t("notice.sparkResponse", { actor, others: item.others, title })
                : item.type === "submission" || item.type === "accepted" || item.type === "declined"
                  ? t(`notice.${item.type}`, { actor, others: item.others, title, circle: item.circle?.name ?? "" })
                  : t(`notice.${item.type}`, { actor, others: item.others, title });
          const href =
            item.type === "submission" && item.circle
              ? `/${locale}/circles/${item.circle.slug}/manage`
              : item.type === "follow" && item.actor
              ? profilePath(item.actor.username)
              : item.story
                ? `${storyPath(item.story.author, item.story.slug)}${item.type === "spark" && !item.responseExcerpt ? "" : "#responses"}`
                : "#";
          return (
            <li key={item.id}>
              <NextLink
                href={href}
                className={cn("flex flex-col gap-1 px-2 py-4 hover:bg-accent", item.unread && "bg-ember-soft/40")}
                data-testid="notification"
              >
                <span className="flex items-start gap-2">
                  {item.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label={t("unread")} /> : null}
                  <span>{message}</span>
                </span>
                {item.responseExcerpt && item.type !== "spark" ? (
                  <span className="pl-4 font-serif text-sm text-muted-foreground italic">“{item.responseExcerpt}”</span>
                ) : null}
                <time className="pl-4 text-xs text-muted-foreground" dateTime={item.updatedAt.toISOString()}>
                  {format.dateTime(item.updatedAt, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </NextLink>
            </li>
          );
        })}
      </ul>
    </>
  );
}
