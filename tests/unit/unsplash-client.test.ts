import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUnsplashSearch, triggerUnsplashDownload, UnsplashError } from "@/lib/unsplash/client";
import { apiPhoto } from "./fixtures/unsplash";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("UNSPLASH_ACCESS_KEY", "test-access-key");
  vi.stubEnv("UNSPLASH_LANG_BETA", "");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const lastRequest = () => {
  const [input, init] = fetchMock.mock.calls.at(-1)!;
  return { url: new URL(String(input)), headers: new Headers(init?.headers) };
};

describe("fetchUnsplashSearch", () => {
  it("signs the request server-side and asks for safe results", async () => {
    fetchMock.mockResolvedValue(Response.json({ total: 1, total_pages: 3, results: [apiPhoto()] }));
    const result = await fetchUnsplashSearch({ query: "campfire", page: 2, locale: "en" });

    const { url, headers } = lastRequest();
    expect(url.origin + url.pathname).toBe("https://api.unsplash.com/search/photos");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: "campfire",
      page: "2",
      per_page: "24",
      content_filter: "high",
    });
    expect(headers.get("authorization")).toBe("Client-ID test-access-key");
    expect(headers.get("accept-version")).toBe("v1");
    expect(result).toMatchObject({ totalPages: 3, photos: [{ id: "Fg4tA0campfire" }] });
  });

  it("sends the query language only when Unsplash's lang beta is enabled", async () => {
    fetchMock.mockResolvedValue(Response.json({ total_pages: 1, results: [] }));
    await fetchUnsplashSearch({ query: "fogata", page: 1, locale: "es" });
    expect(lastRequest().url.searchParams.has("lang")).toBe(false);

    vi.stubEnv("UNSPLASH_LANG_BETA", "true");
    fetchMock.mockResolvedValue(Response.json({ total_pages: 1, results: [] }));
    await fetchUnsplashSearch({ query: "fogata", page: 1, locale: "es" });
    expect(lastRequest().url.searchParams.get("lang")).toBe("es");
  });

  it("surfaces rate limits and missing keys as UnsplashError", async () => {
    fetchMock.mockResolvedValue(new Response("Rate Limit Exceeded", { status: 403 }));
    await expect(fetchUnsplashSearch({ query: "fire", page: 1, locale: "en" })).rejects.toMatchObject({
      name: "UnsplashError",
      status: 403,
    });

    vi.stubEnv("UNSPLASH_ACCESS_KEY", "");
    await expect(fetchUnsplashSearch({ query: "fire", page: 1, locale: "en" })).rejects.toBeInstanceOf(UnsplashError);
  });
});

describe("triggerUnsplashDownload", () => {
  it("hits the download-tracking endpoint for that photo", async () => {
    fetchMock.mockResolvedValue(Response.json({ url: "https://images.unsplash.com/photo-1" }));
    await triggerUnsplashDownload("Fg4tA0campfire");
    expect(lastRequest().url.toString()).toBe("https://api.unsplash.com/photos/Fg4tA0campfire/download");
  });
});
