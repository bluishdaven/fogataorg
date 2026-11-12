import { describe, expect, it } from "vitest";
import { feedHandle, feedSlug, rssFeed, rssPaths, xmlEscape } from "@/lib/domain/rss";

describe("RSS feeds", () => {
  it("escape writers' text so it stays data", () => {
    expect(xmlEscape(`<b>"Tom" & 'Jerry'</b>\u0007`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;");
  });

  it("list items with excerpts, permalinks and dates", () => {
    const xml = rssFeed({
      title: "Ana on Fogata",
      link: "https://fogata.org/@ana",
      selfUrl: "https://fogata.org/rss/@ana.xml",
      description: "Stories <by> Ana",
      language: "es",
      items: [
        { title: "Humo & ceniza", link: "https://fogata.org/@ana/humo", description: "Una tarde.", author: "Ana", publishedAt: new Date("2026-11-02T10:00:00Z") },
        { title: "Sin fecha", link: "https://fogata.org/@ana/x", description: "", author: "Ana", publishedAt: null },
      ],
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<title>Humo &amp; ceniza</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://fogata.org/@ana/humo</guid>');
    expect(xml).toContain("<pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate>");
    expect(xml).toContain("<lastBuildDate>Mon, 02 Nov 2026 10:00:00 GMT</lastBuildDate>");
    expect(xml).toContain("<description>Stories &lt;by&gt; Ana</description>");
    expect(xml).toContain('<atom:link href="https://fogata.org/rss/@ana.xml" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<language>es</language>");
  });

  it("read handles and slugs from file names, and nothing else", () => {
    expect(feedHandle("@ana_lopez.xml")).toBe("ana_lopez");
    expect(feedHandle("%40ana.xml")).toBe("ana");
    expect(feedHandle("ana.xml")).toBeNull();
    expect(feedHandle("@a.xml")).toBeNull();
    expect(feedSlug("Jardin-de-agua.xml")).toBe("jardin-de-agua");
    expect(feedSlug("../x.xml")).toBeNull();
    expect(rssPaths.writer("ana")).toBe("/rss/@ana.xml");
    expect(rssPaths.topic("poesia", "es")).toBe("/rss/topics/poesia.xml?lang=es");
  });
});
