import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { isLocale } from "@/lib/domain/locale";
import { unsubscribeWithToken, userIdFromUnsubscribeToken } from "@/lib/email/preferences";

/**
 * RFC 8058 one-click unsubscribe. Mail clients POST here (body
 * "List-Unsubscribe=One-Click") from the List-Unsubscribe header; the token
 * in the URL identifies the reader.
 */
export async function POST(request: NextRequest) {
  const done = await unsubscribeWithToken(request.nextUrl.searchParams.get("token"));
  if (!done) return new NextResponse("Invalid unsubscribe link", { status: 400 });
  return new NextResponse("Unsubscribed", { status: 200 });
}

/**
 * A browser that opens the header link gets the confirm page instead: link
 * scanners prefetch GET URLs, so GET never changes anything.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = userIdFromUnsubscribeToken(token);
  let locale = "en";
  if (userId) {
    const [row] = await db.select({ locale: profiles.locale }).from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (row && isLocale(row.locale)) locale = row.locale;
  }
  const target = new URL(`/${locale}/email/unsubscribe`, request.nextUrl);
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}
