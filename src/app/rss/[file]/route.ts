import { feedHandle, RSS_HEADERS } from "@/lib/domain/rss";
import { writerFeed } from "@/lib/rss/feeds";

/** A writer's stories as RSS: /rss/@handle.xml. */
export async function GET(_request: Request, { params }: RouteContext<"/rss/[file]">) {
  const handle = feedHandle((await params).file);
  const xml = handle ? await writerFeed(handle) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: RSS_HEADERS });
}
