import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import {
  unsplashSearchParamsSchema,
  type UnsplashSearchError,
  type UnsplashSearchResponse,
} from "@/lib/domain/unsplash";
import { UnsplashError, unsplashAccessKey } from "@/lib/unsplash/client";
import { searchUnsplash } from "@/lib/unsplash/search";

function fail(error: UnsplashSearchError, status: number) {
  return NextResponse.json<UnsplashSearchResponse>({ error }, { status });
}

/**
 * Photo search for writers. Signed-in only, so the shared Unsplash quota can't
 * be drained anonymously. GET /api/unsplash/search?q=campfire&page=1&locale=es
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return fail("unauthorized", 401);
  if (!unsplashAccessKey()) return fail("not_configured", 503);

  const { searchParams } = request.nextUrl;
  const parsed = unsplashSearchParamsSchema.safeParse({
    q: searchParams.get("q") ?? "",
    page: searchParams.get("page") ?? undefined,
    locale: searchParams.get("locale") ?? undefined,
  });
  if (!parsed.success) return fail("invalid", 400);

  try {
    const result = await searchUnsplash({
      query: parsed.data.q,
      page: parsed.data.page,
      locale: parsed.data.locale,
    });
    return NextResponse.json<UnsplashSearchResponse>(result, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    if (error instanceof UnsplashError && (error.status === 403 || error.status === 429)) {
      return fail("rate_limited", 429);
    }
    console.error("[unsplash] search failed", error instanceof Error ? error.message : error);
    return fail("upstream", 502);
  }
}
