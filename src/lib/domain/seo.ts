import { LOCALES } from "./locale";

/**
 * Search-engine rules shared by metadata, robots.txt and the sitemap. Pure, so they're unit tested.
 */

/** Canonical and hreflang links for a page that exists under every locale prefix (/en, /es). */
export function localeAlternates(locale: string, path: string) {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}${suffix}`])),
      "x-default": `/en${suffix}`,
    },
  };
}

/**
 * robots.txt: the public site lets everything be crawled except private areas and APIs (share
 * images stay reachable, since X and others honor robots.txt when fetching them). Previews and
 * local builds ask crawlers to stay out entirely.
 */
export function robotsPolicy(isPublicSite: boolean, siteUrl: string) {
  if (!isPublicSite) return { rules: [{ userAgent: "*", disallow: ["/"] }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og/"],
        disallow: ["/api/", "/auth/", "/*/me/", "/*/settings/", "/*/write", "/*/admin/"],
      },
    ],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}

/**
 * JSON-LD for a <script type="application/ld+json">. Escapes the characters that could close the
 * script element or break the line in old parsers, so user text (titles, bios) stays data.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));
}
