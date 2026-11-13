import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { safeEqual } from "@/lib/domain/email-tokens";
import { cronSecret, emailSigningSecret } from "@/lib/email/config";
import { DEFAULT_DAILY_LIMIT, sendNotificationEmails } from "@/lib/email/notification-emails";
import { EmailNotConfiguredError, sendEmail } from "@/lib/email/transport";
import { publicEnv } from "@/lib/env";
import { pushConfig, sendPendingPushes, webPushSender } from "@/lib/push/send";
import { removeOrphanedUploads, storageSecretKey } from "@/lib/storage-cleanup";

// Sends are spaced for Resend's rate limit; give a full run room to finish.
export const maxDuration = 300;

/** Summaries per run; raise it when the Resend plan allows more than 100 emails a day. */
function dailyLimit(): number {
  const value = Number.parseInt(process.env.EMAIL_SUMMARY_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DAILY_LIMIT;
}

/**
 * Weekly activity summaries, phased: each daily run emails the readers whose
 * weekday it is. Vercel Cron calls this (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`; anything else gets a 401.
 */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Scheduled stories go live without a database write, so tiers they complete are announced here
  // (once a day), before the summaries are built. Runs even when email isn't configured.
  const [badges] = await db.execute<{ checked: number }>(sql`select public.check_due_writing_badges() as checked`);
  console.info("[badges] writers checked", badges?.checked ?? 0);
  // Badges from scheduled stories have no action to push them: push them here.
  const push = pushConfig();
  if (push) {
    try {
      console.info("[push]", await sendPendingPushes({ db, send: webPushSender(push) }));
    } catch (error) {
      console.error("[push] run failed", error);
    }
  }
  // Rate-limit records older than any window are forgotten.
  const [pruned] = await db.execute<{ removed: number }>(sql`select public.prune_rate_limits() as removed`);
  console.info("[limits] old hits removed", pruned?.removed ?? 0);
  const [reads] = await db.execute<{ removed: number }>(sql`select public.prune_read_events() as removed`);
  console.info("[reads] old reads removed", reads?.removed ?? 0);
  // Uploaded pictures and photos nothing uses any more (needs SUPABASE_SECRET_KEY).
  try {
    const cleanup = await removeOrphanedUploads(db, {
      supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      secretKey: storageSecretKey(),
    });
    console.info("[storage] orphaned uploads", cleanup);
  } catch (error) {
    console.error("[storage] orphaned upload cleanup failed", error);
  }

  const signingSecret = emailSigningSecret();
  if (!signingSecret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  try {
    const result = await sendNotificationEmails({
      db,
      send: sendEmail,
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
      signingSecret,
      limit: dailyLimit(),
    });
    console.info("[email] summaries", result);
    if (result.limited) {
      console.warn("[email] daily summary cap reached; some readers wait until next week. Raise EMAIL_SUMMARY_DAILY_LIMIT with the Resend plan.");
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    throw error;
  }
}
