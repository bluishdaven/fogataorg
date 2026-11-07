/** Home page feeds. Signed-out visitors get Latest and Burning now; signed-in readers all four. */
export const FEEDS = ["for-you", "following", "burning", "latest"] as const;
export type Feed = (typeof FEEDS)[number];

export function feedsFor(signedIn: boolean): Feed[] {
  return signedIn ? [...FEEDS] : ["latest", "burning"];
}

/** The `?feed=` value to show; anything unknown or not available falls back to the first tab. */
export function parseFeed(value: unknown, signedIn: boolean): Feed {
  const available = feedsFor(signedIn);
  const first = available[0] ?? "latest";
  return typeof value === "string" && (available as string[]).includes(value) ? (value as Feed) : first;
}

/** Feed links: the default tab has no query string, so the plain home URL stays canonical. */
export function feedQuery(feed: Feed, signedIn: boolean): Record<string, string> {
  return feed === feedsFor(signedIn)[0] ? {} : { feed };
}

/** Places the stories in `rest` that aren't already in `first` after it, up to `limit`. */
export function fillFeed<T extends { key: string }>(first: T[], rest: T[], limit: number): T[] {
  const seen = new Set(first.map((item) => item.key));
  return [...first, ...rest.filter((item) => !seen.has(item.key))].slice(0, limit);
}
