import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { selectNotificationItems } from "@/lib/data/notification-items";
import type { DbExecutor } from "@/lib/db/rls-context";
import { notifications, profiles } from "@/lib/db/schema";
import { isLocale } from "@/lib/domain/locale";
import { buildSummaryEmail } from "./summary";
import type { SendEmail } from "./transport";

/**
 * Batched activity summaries. Each run emails every reader who has unread
 * notifications they haven't been emailed about, at most once per day or week
 * depending on their setting. Runs as the database owner because recipient
 * addresses live in `auth.users`; nothing here takes user input.
 */

/** Leave just-created notifications for the next run, in case they're seen in the app first. */
export const SETTLE_MS = 10 * 60_000;
/** Older unread notifications are never emailed (avoids a backlog email when someone opts in). */
export const LOOKBACK_MS = 8 * 24 * 60 * 60_000;
/** Slightly under a day/week so a daily cron that drifts within the hour still sends. */
export const MIN_GAP_MS = { daily: 23 * 60 * 60_000, weekly: 6.5 * 24 * 60 * 60_000 } as const;
/** Bounds one run; anyone left over is picked up by the next one. */
export const USERS_PER_RUN = 300;
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

export type NotificationEmailResult = { sent: number; failed: number; skipped: number };

export async function sendNotificationEmails(job: NotificationEmailJob): Promise<NotificationEmailResult> {
  const { db, send } = job;
  const now = job.now ?? new Date();
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
        or(
          and(eq(profiles.emailFrequency, "daily"), or(isNull(profiles.emailLastSentAt), lte(profiles.emailLastSentAt, new Date(now.getTime() - MIN_GAP_MS.daily)))),
          and(eq(profiles.emailFrequency, "weekly"), or(isNull(profiles.emailLastSentAt), lte(profiles.emailLastSentAt, new Date(now.getTime() - MIN_GAP_MS.weekly)))),
        ),
        sql`exists (
          select 1 from public.notifications n
          where n.user_id = "profiles"."id" and n.read_at is null and n.emailed_at is null
            and n.updated_at <= ${settledBefore.toISOString()}::timestamptz
            and n.updated_at > ${since.toISOString()}::timestamptz
        )`,
      ),
    )
    .orderBy(asc(profiles.emailLastSentAt))
    .limit(job.limit ?? USERS_PER_RUN);

  const result: NotificationEmailResult = { sent: 0, failed: 0, skipped: 0 };

  for (const user of candidates) {
    if (!user.email || user.frequency === "off") {
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
        frequency: user.frequency,
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
