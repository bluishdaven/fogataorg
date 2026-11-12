import type { NextRequest } from "next/server";
import { feedSlug, RSS_HEADERS } from "@/lib/domain/rss";
import { circleFeed, feedLocale } from "@/lib/rss/feeds";

/** A circle's accepted stories as RSS: /rss/circles/<slug>.xml?lang=es. */
export async function GET(request: NextRequest, { params }: RouteContext<"/rss/circles/[file]">) {
  const slug = feedSlug((await params).file);
  const xml = slug ? await circleFeed(slug, feedLocale(request.nextUrl.searchParams.get("lang"))) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: RSS_HEADERS });
}
