import type { NextRequest } from "next/server";
import { feedSlug, RSS_HEADERS } from "@/lib/domain/rss";
import { feedLocale, topicFeed } from "@/lib/rss/feeds";

/** A topic's latest stories as RSS: /rss/topics/<slug>.xml?lang=es. */
export async function GET(request: NextRequest, { params }: RouteContext<"/rss/topics/[file]">) {
  const slug = feedSlug((await params).file);
  const xml = slug ? await topicFeed(slug, feedLocale(request.nextUrl.searchParams.get("lang"))) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: RSS_HEADERS });
}
