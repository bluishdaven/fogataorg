import { WRITING_TIERS, type WritingTierKey } from "./badges";
import { profilePath, storyPath } from "./handle-routes";

/**
 * How a grouped notification reads and where it links, shared by the
 * notifications page and the summary email so both say the same thing.
 */

export type NotificationItem = {
  type:
    | "spark"
    | "response"
    | "reply"
    | "mention"
    | "follow"
    | "submission"
    | "accepted"
    | "declined"
    | "badge"
    | "donor"
    | "join_request"
    | "join_accepted"
    | "circle_owner"
    | "featured"
    | "founding";
  actor: { username: string; name: string } | null;
  others: number;
  story: { title: string; slug: string; author: string } | null;
  responseExcerpt: string | null;
  circle: { slug: string; name: string } | null;
  /** Badge notifications: the writing tier key, "donor" or "founding", whose profile shows it and
   * (founding) their number. */
  badge?: { key: string; username: string; number?: number | null } | null;
  /** Declined submissions: the editors' note to the writer, if they left one. */
  note?: string | null;
};

/** A stored writing tier key, if it is one (rows come from the database). */
export function badgeTier(key: string | null | undefined): (typeof WRITING_TIERS)[number] | null {
  return WRITING_TIERS.find((tier) => tier.key === key) ?? null;
}

export type { WritingTierKey };

/** A translator scoped to the `Social` namespace (next-intl's `t`). */
export type SocialTranslator = (key: string, values: Record<string, string | number>) => string;

export function notificationMessage(t: SocialTranslator, item: NotificationItem): string {
  const actor = item.actor?.name ?? t("someone", {});
  const title = item.story?.title ?? "";
  const tier = badgeTier(item.badge?.key);
  const values = {
    actor,
    others: item.others,
    title,
    circle: item.circle?.name ?? "",
    badge: tier?.key ?? "other",
    count: tier?.min ?? 0,
    number: item.badge?.number ?? 0,
  };
  if (item.type === "spark" && item.responseExcerpt) return t("notice.sparkResponse", values);
  return t(`notice.${item.type}`, values);
}

/** Site-relative link for a notification (locale prefix only where the UI needs one). */
export function notificationPath(item: NotificationItem, locale: string): string {
  if ((item.type === "badge" || item.type === "donor" || item.type === "founding") && item.badge) return profilePath(item.badge.username);
  if ((item.type === "submission" || item.type === "join_request" || item.type === "circle_owner") && item.circle) {
    return `/${locale}/circles/${item.circle.slug}/manage`;
  }
  if (item.type === "join_accepted" && item.circle) return `/${locale}/circles/${item.circle.slug}`;
  if (item.type === "follow" && item.actor) return profilePath(item.actor.username);
  if (item.story) {
    const base = storyPath(item.story.author, item.story.slug);
    return (item.type === "spark" && !item.responseExcerpt) || item.type === "featured" ? base : `${base}#responses`;
  }
  return `/${locale}/me/notifications`;
}
