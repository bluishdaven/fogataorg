import { describe, expect, it } from "vitest";
import { Pilcrow } from "lucide-react";
import { filterSlashItems, type SlashItem } from "@/components/editor/slash-command";
import { scaledSize } from "@/lib/domain/images";
import { profileUpdateSchema } from "@/lib/domain/profile";
import {
  DEFAULT_READER_PREFS,
  parseReaderPrefs,
  READER_PREFS_SCRIPT,
  readerPrefsAttributes,
} from "@/lib/domain/reader-prefs";
import { draftSlug, isDraftSlug, publishSchema, storyImagePrefix, storyState } from "@/lib/domain/stories";

const NOW = new Date("2026-11-05T12:00:00Z");

describe("storyState", () => {
  it("derives scheduled from a future publish date", () => {
    expect(storyState({ status: "draft", publishedAt: null }, NOW)).toBe("draft");
    expect(storyState({ status: "published", publishedAt: new Date("2026-11-06T00:00:00Z") }, NOW)).toBe("scheduled");
    expect(storyState({ status: "published", publishedAt: new Date("2026-11-04T00:00:00Z") }, NOW)).toBe("published");
    expect(storyState({ status: "unlisted", publishedAt: new Date("2026-11-04T00:00:00Z") }, NOW)).toBe("unlisted");
    expect(storyState({ status: "unlisted", publishedAt: new Date("2026-11-07T00:00:00Z") }, NOW)).toBe("scheduled");
  });
});

describe("draft slugs", () => {
  it("are recognizable so the first publish can replace them", () => {
    const slug = draftSlug("8391c012-560d-4bb7-9e5a-4aaa45f1b8e3");
    expect(slug).toBe("draft-8391c012560d");
    expect(isDraftSlug(slug)).toBe(true);
    expect(isDraftSlug("draft-of-my-novel")).toBe(false);
  });

  it("builds the public bucket prefix", () => {
    expect(storyImagePrefix("http://127.0.0.1:54321/")).toBe("http://127.0.0.1:54321/storage/v1/object/public/story-images/");
  });
});

describe("publishSchema", () => {
  const base = {
    id: "8391c012-560d-4bb7-9e5a-4aaa45f1b8e3",
    cover: null,
    topics: ["nature", "travel", "nature"],
    language: "es",
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    visibility: "public",
    publishAt: null,
  } as const;

  it("accepts a minimal publish and de-duplicates topics", () => {
    expect(publishSchema.parse(base).topics).toEqual(["nature", "travel"]);
  });

  it("maps problems to message keys", () => {
    const messages = (input: object) => publishSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(messages({ topics: ["a", "b", "c", "d", "e", "f"] })).toContain("tooManyTopics");
    expect(messages({ seoTitle: "x".repeat(71) })).toContain("seoTitle");
    expect(messages({ seoDescription: "x".repeat(161) })).toContain("seoDescription");
    expect(messages({ canonicalUrl: "http://example.com/post" })).toContain("canonicalUrl");
    expect(messages({ cover: { url: "https://images.unsplash.com/x", alt: "  ", credit: null } })).toContain("coverAlt");
  });

  it("requires ISO timestamps for scheduling", () => {
    expect(publishSchema.safeParse({ ...base, publishAt: "2026-11-06T09:00:00.000Z" }).success).toBe(true);
    expect(publishSchema.safeParse({ ...base, publishAt: "tomorrow" }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  const base = { displayName: "Lucía", username: "lucia_ortega", bio: "", links: [] };

  it("normalizes links and adds https when missing", () => {
    const parsed = profileUpdateSchema.parse({ ...base, links: [{ label: " Sitio ", url: "lucia.example/blog" }] });
    expect(parsed.links).toEqual([{ label: "Sitio", url: "https://lucia.example/blog" }]);
  });

  it("rejects reserved names, unsafe links and too many links", () => {
    const messages = (input: object) =>
      profileUpdateSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.message) ?? [];
    expect(messages({ username: "Fogata" })).toContain("usernameReserved");
    expect(messages({ links: [{ label: "x", url: "javascript:alert(1)" }] })).toContain("linkUrl");
    expect(messages({ links: [{ label: "x", url: "notaurl" }] })).toContain("linkUrl");
    expect(messages({ links: Array.from({ length: 6 }, () => ({ label: "x", url: "https://a.example" })) })).toContain("tooManyLinks");
  });
});

describe("reader preferences", () => {
  it("parses stored values defensively", () => {
    expect(parseReaderPrefs('{"size":"xl","font":"sans","width":"wide"}')).toEqual({ size: "xl", font: "sans", width: "wide" });
    expect(parseReaderPrefs('{"size":"huge"}')).toEqual(DEFAULT_READER_PREFS);
    expect(parseReaderPrefs("not json")).toEqual(DEFAULT_READER_PREFS);
    expect(parseReaderPrefs(null)).toEqual(DEFAULT_READER_PREFS);
  });

  it("leaves defaults off <html> so base tokens apply", () => {
    expect(readerPrefsAttributes(DEFAULT_READER_PREFS)).toEqual({ readerSize: undefined, readerFont: undefined, readerWidth: undefined });
    expect(readerPrefsAttributes({ size: "l", font: "sans", width: "narrow" })).toEqual({
      readerSize: "l",
      readerFont: "sans",
      readerWidth: "narrow",
    });
  });

  it("pre-paint script applies saved prefs and ignores junk", () => {
    const run = (stored: string | null) => {
      const dataset: Record<string, string> = {};
      new Function("localStorage", "document", READER_PREFS_SCRIPT)(
        { getItem: () => stored },
        { documentElement: { dataset } },
      );
      return dataset;
    };
    expect(run('{"size":"xl","font":"sans","width":"narrow"}')).toEqual({ readerSize: "xl", readerFont: "sans", readerWidth: "narrow" });
    expect(run('{"size":"m","font":"<script>"}')).toEqual({});
    expect(run("{broken")).toEqual({});
    expect(run(null)).toEqual({});
  });
});

describe("editor helpers", () => {
  it("filters slash items by title or keyword, ignoring accents", () => {
    const item = (id: string, title: string, keywords: string[]): SlashItem => ({
      id,
      title,
      description: "",
      keywords,
      icon: Pilcrow,
      run: () => {},
    });
    const items = [item("h2", "Título", ["h2", "encabezado"]), item("img", "Imagen", ["foto", "photo"])];
    expect(filterSlashItems(items, "titu").map((i) => i.id)).toEqual(["h2"]);
    expect(filterSlashItems(items, "PHOTO").map((i) => i.id)).toEqual(["img"]);
    expect(filterSlashItems(items, "")).toHaveLength(2);
    expect(filterSlashItems(items, "zzz")).toEqual([]);
  });

  it("scales images to fit 2400px without upscaling", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 2400, height: 1800 });
    expect(scaledSize(1200, 5000)).toEqual({ width: 576, height: 2400 });
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
