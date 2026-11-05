import { profilePath, storyPath } from "./handle-routes";

/**
 * How a grouped notification reads and where it links, shared by the
 * notifications page and the summary email so both say the same thing.
 */

export type NotificationItem = {
  type: "spark" | "response" | "reply" | "mention" | "follow" | "submission" | "accepted" | "declined";
  actor: { username: string; name: string } | null;
  others: number;
  story: { title: string; slug: string; author: string } | null;
  responseExcerpt: string | null;
  circle: { slug: string; name: string } | null;
};

/** A translator scoped to the `Social` namespace (next-intl's `t`). */
export type SocialTranslator = (key: string, values: Record<string, string | number>) => string;

export function notificationMessage(t: SocialTranslator, item: NotificationItem): string {
  const actor = item.actor?.name ?? t("someone", {});
  const title = item.story?.title ?? "";
  const values = { actor, others: item.others, title, circle: item.circle?.name ?? "" };
  if (item.type === "spark" && item.responseExcerpt) return t("notice.sparkResponse", values);
  return t(`notice.${item.type}`, values);
}

/** Site-relative link for a notification (locale prefix only where the UI needs one). */
export function notificationPath(item: NotificationItem, locale: string): string {
  if (item.type === "submission" && item.circle) return `/${locale}/circles/${item.circle.slug}/manage`;
  if (item.type === "follow" && item.actor) return profilePath(item.actor.username);
  if (item.story) {
    const base = storyPath(item.story.author, item.story.slug);
    return item.type === "spark" && !item.responseExcerpt ? base : `${base}#responses`;
  }
  return `/${locale}/me/notifications`;
}
