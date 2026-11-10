import { describe, expect, it } from "vitest";
import { drawableImage, PREVIEW_LINES, previewLinesThatFit, withAlpha } from "@/lib/domain/share-image";
import { publishSchema } from "@/lib/domain/stories";

const SUPABASE = "https://abc.supabase.co";

describe("share image rules", () => {
  it("shows up to the chosen length's lines, fewer when space runs out, none below two", () => {
    expect(PREVIEW_LINES).toEqual({ s: 3, m: 6, l: 12 });
    expect(previewLinesThatFit("m", 1000, 64, 72)).toBe(6);
    expect(previewLinesThatFit("l", 1000, 64, 72)).toBe(12);
    expect(previewLinesThatFit("l", 72 + 64 * 5, 64, 72)).toBe(5);
    expect(previewLinesThatFit("s", 72 + 64 * 1.5, 64, 72)).toBe(0);
  });

  it("draws uploads as they are and Unsplash photos from Unsplash with the photographer, nothing else", () => {
    const upload = `${SUPABASE}/storage/v1/object/public/story-images/u1/cover.webp`;
    expect(drawableImage(upload, null, SUPABASE)).toEqual({ url: upload, photographer: null });
    const unsplash = drawableImage(
      "https://images.unsplash.com/photo-1?ixid=abc",
      { source: "unsplash", photoId: "x", authorName: "Ana Ruiz", authorUrl: "https://unsplash.com/@ana", photoUrl: "https://unsplash.com/photos/x" },
      SUPABASE,
    );
    expect(unsplash?.photographer).toBe("Ana Ruiz");
    expect(new URL(unsplash!.url).searchParams.get("ixid")).toBe("abc");
    expect(new URL(unsplash!.url).searchParams.get("w")).toBe("1200");
    expect(drawableImage("https://evil.example/cover.jpg", null, SUPABASE)).toBeNull();
    expect(drawableImage(null, null, SUPABASE)).toBeNull();
  });

  it("turns hex colors into canvas colors with transparency", () => {
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("#0f766e", 1)).toBe("rgba(15, 118, 110, 1)");
  });
});

describe("story color", () => {
  const base = {
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    cover: null,
    topics: [],
    language: "en",
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    visibility: "public",
    publishAt: null,
  } as const;

  it("is optional, a hex color, kept in lowercase", () => {
    expect(publishSchema.parse(base).accentColor).toBeNull();
    expect(publishSchema.parse({ ...base, accentColor: "#0F766E" }).accentColor).toBe("#0f766e");
    expect(publishSchema.safeParse({ ...base, accentColor: "teal" }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, accentColor: "#0f766e; background:url(x)" }).success).toBe(false);
  });
});
