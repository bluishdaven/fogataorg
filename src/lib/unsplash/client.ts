import "server-only";
import { parseUnsplashResults, type UnsplashSearchResult } from "@/lib/domain/unsplash";

/**
 * Thin Unsplash API client. Runs only on the server so the access key never
 * reaches the browser (Unsplash guideline: keep credentials confidential).
 * Cached wrappers live in ./search.ts.
 */

const API_URL = "https://api.unsplash.com";
const PER_PAGE = 24;

export class UnsplashError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "UnsplashError";
  }
}

export function unsplashAccessKey(): string | null {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  return key ? key : null;
}

async function request(path: string, params: Record<string, string> = {}): Promise<Response> {
  const key = unsplashAccessKey();
  if (!key) throw new UnsplashError(503, "UNSPLASH_ACCESS_KEY is not set");
  const url = new URL(path, API_URL);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new UnsplashError(response.status, `Unsplash ${path} responded ${response.status}`);
  }
  return response;
}

export async function fetchUnsplashSearch(input: {
  query: string;
  page: number;
  locale: "en" | "es";
}): Promise<UnsplashSearchResult> {
  const params: Record<string, string> = {
    query: input.query,
    page: String(input.page),
    per_page: String(PER_PAGE),
    content_filter: "high",
  };
  // Non-English queries need Unsplash's `lang` beta (enabled per app by emailing them).
  if (input.locale !== "en" && process.env.UNSPLASH_LANG_BETA === "true") params.lang = input.locale;

  const response = await request("/search/photos", params);
  const body = (await response.json()) as { results?: unknown; total_pages?: unknown };
  return {
    photos: parseUnsplashResults(body.results),
    totalPages: typeof body.total_pages === "number" ? Math.min(body.total_pages, 50) : 1,
  };
}

/**
 * Tells Unsplash a photo was used (added to a story or set as a cover).
 * Required by the API guidelines; tracking only, the response isn't needed.
 */
export async function triggerUnsplashDownload(photoId: string): Promise<void> {
  await request(`/photos/${encodeURIComponent(photoId)}/download`);
}
