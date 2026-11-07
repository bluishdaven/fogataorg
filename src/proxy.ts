import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  matchInternalHandlePath,
  matchPublicHandlePath,
  publicHandlePath,
  toInternalHandlePath,
} from "@/lib/domain/handle-routes";
import { wantsHandleCheck } from "@/lib/domain/handle-status";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, resolveLocale } from "@/lib/domain/locale";
import { handleStatus } from "@/lib/handle-status";
import { refreshSession } from "@/lib/supabase/proxy";

const intl = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const apply = await refreshSession(request);

  // Auth landing routes live outside the locale tree.
  if (pathname.startsWith("/auth/")) {
    return apply(NextResponse.next({ request }));
  }

  // /en/u/handle/slug is an implementation detail: send people to the share URL.
  const internal = matchInternalHandlePath(pathname);
  if (internal) {
    const url = request.nextUrl.clone();
    url.pathname = publicHandlePath(internal.route);
    const response = NextResponse.redirect(url, 308);
    response.cookies.set(LOCALE_COOKIE, internal.locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
    return apply(response);
  }

  // /@handle and /@handle/slug: render inside the reader's UI locale without changing the URL.
  const handleRoute = matchPublicHandlePath(pathname);
  if (handleRoute) {
    const locale = resolveLocale({
      cookie: request.cookies.get(LOCALE_COOKIE)?.value,
      acceptLanguage: request.headers.get("accept-language"),
    });
    const url = request.nextUrl.clone();
    // Check before the page streams so a miss gets a real 404 and an old username a redirect.
    const status = wantsHandleCheck(request.headers.get("sec-fetch-dest")) ? await handleStatus(handleRoute) : null;
    if (status?.kind === "moved") {
      url.pathname = publicHandlePath(status.to);
      const response = NextResponse.redirect(url, 308);
      // Not forever: the person may take the old name back.
      response.headers.set("Cache-Control", "public, max-age=3600");
      return apply(response);
    }
    // Any path the app doesn't know renders the localized not-found page with a 404 status.
    url.pathname = status?.kind === "missing" ? `/${locale}/__missing` : toInternalHandlePath(locale, handleRoute);
    const response = NextResponse.rewrite(url, { request });
    // The same URL renders differently per locale; keep shared caches honest.
    response.headers.set("Vary", "Cookie, Accept-Language");
    return apply(response);
  }

  return apply(intl(request));
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
