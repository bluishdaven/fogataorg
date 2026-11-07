/** Home page tabs: Latest (the default) and Following. */
export const FEEDS = ["latest", "following"] as const;
export type Feed = (typeof FEEDS)[number];

/** The `?feed=` value to show; anything else is Latest. */
export function parseFeed(value: unknown): Feed {
  return value === "following" ? "following" : "latest";
}

/** Tab links: Latest has no query string, so the plain home URL stays canonical. */
export function feedQuery(feed: Feed): Record<string, string> {
  return feed === "latest" ? {} : { feed };
}
