/**
 * RSS 2.0 feeds for writers, circles and topics. Items carry the subtitle or an excerpt, never the
 * whole story: readers follow the link to read it on Fogata, and the text isn't handed to anyone
 * who scrapes feeds.
 */

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  author: string;
  publishedAt: Date | null;
};

export type Feed = {
  title: string;
  link: string;
  selfUrl: string;
  description: string;
  language?: string;
  imageUrl?: string;
  items: FeedItem[];
};

/** Escapes text for XML element content and attribute values; drops characters XML 1.0 forbids. */
export function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function rssFeed(feed: Feed): string {
  const tag = (name: string, value: string) => `<${name}>${xmlEscape(value)}</${name}>`;
  const items = feed.items.map((item) =>
    [
      "<item>",
      tag("title", item.title),
      tag("link", item.link),
      `<guid isPermaLink="true">${xmlEscape(item.link)}</guid>`,
      tag("dc:creator", item.author),
      item.publishedAt ? tag("pubDate", item.publishedAt.toUTCString()) : "",
      tag("description", item.description),
      "</item>",
    ].join(""),
  );
  const newest = feed.items.find((item) => item.publishedAt)?.publishedAt;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "<channel>",
    tag("title", feed.title),
    tag("link", feed.link),
    `<atom:link href="${xmlEscape(feed.selfUrl)}" rel="self" type="application/rss+xml"/>`,
    tag("description", feed.description),
    feed.language ? tag("language", feed.language) : "",
    newest ? tag("lastBuildDate", newest.toUTCString()) : "",
    tag("generator", "Fogata.org"),
    feed.imageUrl ? `<image>${tag("url", feed.imageUrl)}${tag("title", feed.title)}${tag("link", feed.link)}</image>` : "",
    ...items,
    "</channel>",
    "</rss>",
  ].join("\n");
}

/** "@ana_lopez.xml" → "ana_lopez"; anything else → null. */
export function feedHandle(file: string): string | null {
  const match = /^@([A-Za-z0-9_]{3,30})\.xml$/.exec(decodeURIComponent(file));
  return match?.[1] ?? null;
}

/** "jardin-de-agua.xml" → "jardin-de-agua"; anything else → null. */
export function feedSlug(file: string): string | null {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.xml$/i.exec(decodeURIComponent(file));
  return match?.[1]?.toLowerCase() ?? null;
}

export const rssPaths = {
  writer: (username: string) => `/rss/@${username}.xml`,
  circle: (slug: string, locale: string) => `/rss/circles/${slug.toLowerCase()}.xml?lang=${locale}`,
  topic: (slug: string, locale: string) => `/rss/topics/${slug}.xml?lang=${locale}`,
};

export const RSS_HEADERS = {
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=900, s-maxage=1800, stale-while-revalidate=86400",
};
