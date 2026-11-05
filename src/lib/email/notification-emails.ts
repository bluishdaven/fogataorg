import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { selectNotificationItems } from "@/lib/data/notification-items";
import type { DbExecutor } from "@/lib/db/rls-context";
import { notifications, profiles } from "@/lib/db/schema";
import { isLocale } from "@/lib/domain/locale";
import { buildSummaryEmail } from "./summary";
import type { SendEmail } from "./transport";

/**
 * Weekly activity summaries, phased: every reader has a fixed weekday
 * (`profiles.email_weekday`, random at sign-up) and the daily run only emails
 * readers whose day it is, so sends spread evenly across the week.
 * A reader gets nothing in a week without new activity. Runs as the database
 * owner because recipient addresses live in `auth.users`; nothing here takes
 * user input.
 */

const DAY_MS = 24 * 60 * 60_000;

/** Leave just-created notifications for the next run, in case they're seen in the app first. */
export const SETTLE_MS = 10 * 60_000;
/** Older unread notifications are never emailed. Two weeks, so a reader skipped once still hears about them. */
export const LOOKBACK_MS = 15 * DAY_MS;
/** On their day, at most one summary: guards reruns and a cron that drifts within the hour. */
export const WEEK_GUARD_MS = 6 * DAY_MS;
/**
 * Most summaries per run. Resend's free tier allows 100 emails a day, shared with magic links.
 * Readers past the cap keep their notifications pending and are first in line next week.
 */
export const DEFAULT_DAILY_LIMIT = 80;
const ITEMS_PER_EMAIL = 50;

export type NotificationEmailJob = {
  db: DbExecutor;
  send: SendEmail;
  siteUrl: string;
  signingSecret: string;
  now?: Date;
  limit?: number;
  /** Only consider these users (tests). */
  onlyUserIds?: string[];
};

export type NotificationEmailResult = {
  sent: number;
  failed: number;
  skipped: number;
  /** True when the run stopped at its cap; some of today's readers wait until next week. */
  limited: boolean;
};

export async function sendNotificationEmails(job: NotificationEmailJob): Promise<NotificationEmailResult> {
  const { db, send } = job;
  const now = job.now ?? new Date();
  const limit = job.limit ?? DEFAULT_DAILY_LIMIT;
  const settledBefore = new Date(now.getTime() - SETTLE_MS);
  const since = new Date(now.getTime() - LOOKBACK_MS);

  const pending = (userId: string) =>
    and(
      eq(notifications.userId, userId),
      isNull(notifications.readAt),
      isNull(notifications.emailedAt),
      lte(notifications.updatedAt, settledBefore),
      gt(notifications.updatedAt, since),
    );

  const candidates = await db
    .select({
      id: profiles.id,
      locale: profiles.locale,
      frequency: profiles.emailFrequency,
      lastSentAt: profiles.emailLastSentAt,
      email: sql<string | null>`(select u.email from auth.users u where u.id = "profiles"."id" and u.email_confirmed_at is not null)`,
      total: sql<number>`(
        select count(*)::int from public.notifications n
        where n.user_id = "profiles"."id" and n.read_at is null and n.emailed_at is null
          and n.updated_at <= ${settledBefore.toISOString()}::timestamptz
          and n.updated_at > ${since.toISOString()}::timestamptz
      )`,
    })
    .from(profiles)
    .where(
      and(
        job.onlyUserIds ? inArray(profiles.id, job.onlyUserIds) : undefined,
        eq(profiles.emailFrequency, "weekly"),
        eq(profiles.emailWeekday, now.getUTCDay()),
        or(isNull(profiles.emailLastSentAt), lte(profiles.emailLastSentAt, new Date(now.getTime() - WEEK_GUARD_MS))),
        sql`exists (
          select 1 from public.notifications n
          where n.user_id = "profiles"."id" and n.read_at is null and n.emailed_at is null
            and n.updated_at <= ${settledBefore.toISOString()}::timestamptz
            and n.updated_at > ${since.toISOString()}::timestamptz
        )`,
      ),
    )
    // Whoever has waited longest goes first, in case the cap cuts the run short.
    .orderBy(sql`${profiles.emailLastSentAt} asc nulls first`)
    .limit(limit + 1);

  const result: NotificationEmailResult = { sent: 0, failed: 0, skipped: 0, limited: candidates.length > limit };

  for (const user of candidates.slice(0, limit)) {
    if (!user.email || user.frequency !== "weekly") {
      result.skipped += 1;
      continue;
    }

    // Claim the user, so overlapping runs never send the same summary twice.
    const claimed = await db
      .update(profiles)
      .set({ emailLastSentAt: now })
      .where(
        and(
          eq(profiles.id, user.id),
          user.lastSentAt ? eq(profiles.emailLastSentAt, user.lastSentAt) : isNull(profiles.emailLastSentAt),
        ),
      )
      .returning({ id: profiles.id });
    if (!claimed.length) {
      result.skipped += 1;
      continue;
    }

    try {
      const items = await selectNotificationItems(db, pending(user.id), ITEMS_PER_EMAIL);
      if (!items.length) throw new NothingToSend();
      const email = await buildSummaryEmail({
        userId: user.id,
        to: user.email,
        locale: isLocale(user.locale) ? user.locale : "en",
        items,
        total: Math.max(user.total, items.length),
        siteUrl: job.siteUrl,
        signingSecret: job.signingSecret,
      });
      await send(email);
      // Only what this email covered; anything that changed since stays pending.
      await db.update(notifications).set({ emailedAt: now }).where(pending(user.id));
      result.sent += 1;
    } catch (error) {
      // Give the claim back so the next run tries again.
      await db
        .update(profiles)
        .set({ emailLastSentAt: user.lastSentAt })
        .where(and(eq(profiles.id, user.id), eq(profiles.emailLastSentAt, now)));
      if (error instanceof NothingToSend) {
        result.skipped += 1;
      } else {
        result.failed += 1;
        console.error("[email] summary failed", { user: user.id, error: error instanceof Error ? error.message : error });
      }
    }
  }

  return result;
}

class NothingToSend extends Error {}
