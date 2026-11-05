import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { safeEqual } from "@/lib/domain/email-tokens";
import { cronSecret, emailSigningSecret } from "@/lib/email/config";
import { sendNotificationEmails } from "@/lib/email/notification-emails";
import { EmailNotConfiguredError, sendEmail } from "@/lib/email/transport";
import { publicEnv } from "@/lib/env";

// Sends are spaced for Resend's rate limit; give a full run room to finish.
export const maxDuration = 300;

/**
 * Daily activity summaries. Vercel Cron calls this (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`; anything else gets a 401.
 */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const signingSecret = emailSigningSecret();
  if (!signingSecret) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  try {
    const result = await sendNotificationEmails({
      db,
      send: sendEmail,
      siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
      signingSecret,
    });
    console.info("[email] summaries", result);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    throw error;
  }
}
