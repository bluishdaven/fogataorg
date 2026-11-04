import { describe, expect, it } from "vitest";
import {
  creditFromPhoto,
  imageCreditSchema,
  isUnsplashImageUrl,
  normalizeUnsplashPhoto,
  parseUnsplashResults,
  unsplashApiPhotoSchema,
  unsplashImageUrl,
  unsplashSearchParamsSchema,
  withUnsplashUtm,
} from "@/lib/domain/unsplash";
import { apiPhoto } from "./fixtures/unsplash";

describe("normalizeUnsplashPhoto", () => {
  it("keeps what we need to show and credit a photo", () => {
    const photo = normalizeUnsplashPhoto(unsplashApiPhotoSchema.parse(apiPhoto()));
    expect(photo).toEqual({
      id: "Fg4tA0campfire",
      width: 4000,
      height: 2667,
      color: "#d96a26",
      alt: "people sitting around a campfire on the beach",
      rawUrl: apiPhoto().urls.raw,
      photoUrl: "https://unsplash.com/photos/people-around-a-campfire-Fg4tA0campfire",
      author: { name: "Ana Ruiz", username: "anaruiz_photo", profileUrl: "https://unsplash.com/@anaruiz_photo" },
    });
  });

  it("falls back to the description for alt text, and drops odd colors", () => {
    const photo = normalizeUnsplashPhoto(
      unsplashApiPhotoSchema.parse(apiPhoto({ alt_description: null, description: "Fogata", color: "red" })),
    );
    expect(photo.alt).toBe("Fogata");
    expect(photo.color).toBeNull();
  });
});

describe("parseUnsplashResults", () => {
  it("drops results that don't come from Unsplash's hosts or miss fields", () => {
    const results = parseUnsplashResults([
      apiPhoto(),
      apiPhoto({ id: "evilhost01", urls: { raw: "https://evil.example/photo.jpg" } }),
      apiPhoto({ id: "httpphoto1", urls: { raw: "http://images.unsplash.com/photo-1" } }),
      apiPhoto({ id: "nouser0001", user: undefined }),
      "nonsense",
    ]);
    expect(results.map((p) => p.id)).toEqual(["Fg4tA0campfire"]);
    expect(parseUnsplashResults(undefined)).toEqual([]);
  });
});

describe("unsplashImageUrl", () => {
  it("resizes on Unsplash's CDN and keeps the ixid tracking param", () => {
    const url = new URL(unsplashImageUrl(apiPhoto().urls.raw, { width: 640.4 }));
    expect(url.hostname).toBe("images.unsplash.com");
    expect(url.searchParams.get("ixid")).toBe(new URL(apiPhoto().urls.raw).searchParams.get("ixid"));
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("75");
    expect(url.searchParams.get("auto")).toBe("format");
  });

  it("recognises Unsplash image URLs", () => {
    expect(isUnsplashImageUrl(apiPhoto().urls.raw)).toBe(true);
    expect(isUnsplashImageUrl("https://images.unsplash.com.evil.example/x")).toBe(false);
    expect(isUnsplashImageUrl("not a url")).toBe(false);
  });
});

describe("credits", () => {
  it("adds Unsplash's referral params to links", () => {
    const url = new URL(withUnsplashUtm("https://unsplash.com/@anaruiz_photo"));
    expect(url.searchParams.get("utm_source")).toBe("fogata");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
  });

  it("builds a storable credit that validates", () => {
    const credit = creditFromPhoto(normalizeUnsplashPhoto(unsplashApiPhotoSchema.parse(apiPhoto())));
    expect(imageCreditSchema.parse(credit)).toEqual({
      source: "unsplash",
      photoId: "Fg4tA0campfire",
      authorName: "Ana Ruiz",
      authorUrl: "https://unsplash.com/@anaruiz_photo",
      photoUrl: "https://unsplash.com/photos/people-around-a-campfire-Fg4tA0campfire",
    });
  });

  it("rejects credits pointing anywhere but unsplash.com", () => {
    const credit = { source: "unsplash", photoId: "Fg4tA0campfire", authorName: "X", photoUrl: "https://unsplash.com/photos/x" };
    expect(imageCreditSchema.safeParse({ ...credit, authorUrl: "https://evil.example/@x" }).success).toBe(false);
    expect(imageCreditSchema.safeParse({ ...credit, authorUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("unsplashSearchParamsSchema", () => {
  it("normalises queries so identical searches share a cache entry", () => {
    expect(unsplashSearchParamsSchema.parse({ q: "  City   At Night " })).toEqual({ q: "city at night", page: 1, locale: "en" });
  });

  it("rejects empty, huge or out-of-range input", () => {
    expect(unsplashSearchParamsSchema.safeParse({ q: "   " }).success).toBe(false);
    expect(unsplashSearchParamsSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(unsplashSearchParamsSchema.safeParse({ q: "fire", page: "0" }).success).toBe(false);
    expect(unsplashSearchParamsSchema.safeParse({ q: "fire", locale: "fr" }).success).toBe(false);
  });
});
