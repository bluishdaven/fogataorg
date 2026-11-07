import { render } from "@react-email/render";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { ActivitySummaryEmail } from "@/emails/activity-summary";
import { createUnsubscribeToken } from "@/lib/domain/email-tokens";
import type { Locale } from "@/lib/domain/locale";
import { notificationMessage, notificationPath, type NotificationItem } from "@/lib/domain/notification-text";
import type { OutgoingEmail } from "./transport";

/** Most notifications listed in one email; the rest become "and N more". */
export const SUMMARY_ITEM_LIMIT = 12;

export type SummaryInput = {
  userId: string;
  to: string;
  locale: Locale;
  items: NotificationItem[];
  /** Unread, not-yet-emailed notifications in total (can exceed `items.length`). */
  total: number;
  siteUrl: string;
  signingSecret: string;
};

const messages = { en, es } as const;

export function unsubscribeUrls(siteUrl: string, locale: Locale, token: string) {
  const query = `token=${encodeURIComponent(token)}`;
  return {
    /** Page with a confirm button (mail scanners prefetch GET links, so GET never unsubscribes). */
    page: new URL(`/${locale}/email/unsubscribe?${query}`, siteUrl).toString(),
    /** RFC 8058 one-click endpoint that mail clients POST to. */
    oneClick: new URL(`/api/email/unsubscribe?${query}`, siteUrl).toString(),
  };
}

export async function buildSummaryEmail(input: SummaryInput): Promise<OutgoingEmail> {
  const { locale, siteUrl } = input;
  const t = createTranslator({ locale, messages: messages[locale], namespace: "Email" });
  const social = createTranslator({ locale, messages: messages[locale], namespace: "Social" });
  const socialT = (key: string, values: Record<string, string | number>) =>
    (social as unknown as (k: string, v: Record<string, string | number>) => string)(key, values);

  const shown = input.items.slice(0, SUMMARY_ITEM_LIMIT);
  const items = shown.map((item) => ({
    text: notificationMessage(socialT, item),
    note: item.note ? socialT("declineNote", { note: item.note }) : undefined,
    href: new URL(notificationPath(item, locale), siteUrl).toString(),
  }));
  const remaining = Math.max(0, input.total - shown.length);
  const token = createUnsubscribeToken(input.userId, input.signingSecret);
  const unsubscribe = unsubscribeUrls(siteUrl, locale, token);

  const email = (
    <ActivitySummaryEmail
      lang={locale}
      preview={items[0]?.text ?? t("intro", { count: input.total })}
      heading={t("heading")}
      intro={t("intro", { count: input.total })}
      items={items}
      more={remaining > 0 ? t("more", { count: remaining }) : null}
      cta={{ label: t("cta"), href: new URL(`/${locale}/me/notifications`, siteUrl).toString() }}
      footer={{
        why: t("why"),
        settingsLabel: t("settings"),
        settingsHref: new URL(`/${locale}/settings/notifications`, siteUrl).toString(),
        unsubscribeLabel: t("unsubscribe"),
        unsubscribeHref: unsubscribe.page,
      }}
    />
  );

  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  return {
    to: input.to,
    subject: t("subject", { count: input.total }),
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
