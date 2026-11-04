import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { UnsplashSearchResult } from "@/lib/domain/unsplash";
import { fetchUnsplashSearch } from "./client";

/**
 * Cached search. Unsplash allows 50 requests/hour in demo mode and 1,000 in
 * production, so identical searches by different writers share one result
 * for a few hours. Errors are never cached.
 */
export async function searchUnsplash(input: {
  query: string;
  page: number;
  locale: "en" | "es";
}): Promise<UnsplashSearchResult> {
  "use cache";
  cacheLife("hours");
  cacheTag("unsplash");
  return fetchUnsplashSearch(input);
}
