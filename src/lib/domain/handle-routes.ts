import { isLocale, type Locale } from "./locale";

/**
 * Public share URLs have no locale prefix:
 *   /@handle           → profile
 *   /@handle/slug      → story
 * The proxy rewrites them to /{locale}/u/handle[/slug] so the surrounding UI
 * can still be rendered (and cached) per locale. The internal path is never
 * linked to; visiting it directly redirects to the public URL.
 */

const HANDLE = "[A-Za-z0-9_]{3,30}";
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";

const PUBLIC_PATTERN = new RegExp(`^/(?:@|%40)(${HANDLE})(?:/(${SLUG}))?/?$`);
const INTERNAL_PATTERN = new RegExp(`^/([a-z]{2})/u/(${HANDLE})(?:/(${SLUG}))?/?$`);

export type HandleRoute = { handle: string; slug?: string };

export function matchPublicHandlePath(pathname: string): HandleRoute | null {
  const match = PUBLIC_PATTERN.exec(pathname);
  if (!match?.[1]) return null;
  return match[2] ? { handle: match[1], slug: match[2] } : { handle: match[1] };
}

export function toInternalHandlePath(locale: Locale, route: HandleRoute): string {
  const base = `/${locale}/u/${route.handle}`;
  return route.slug ? `${base}/${route.slug}` : base;
}

export function matchInternalHandlePath(
  pathname: string,
): { locale: Locale; route: HandleRoute } | null {
  const match = INTERNAL_PATTERN.exec(pathname);
  if (!match?.[2] || !isLocale(match[1])) return null;
  const route: HandleRoute = match[3] ? { handle: match[2], slug: match[3] } : { handle: match[2] };
  return { locale: match[1], route };
}

export function profilePath(handle: string): string {
  return `/@${handle}`;
}

export function storyPath(handle: string, slug: string): string {
  return `/@${handle}/${slug}`;
}

export function publicHandlePath(route: HandleRoute): string {
  return route.slug ? storyPath(route.handle, route.slug) : profilePath(route.handle);
}
