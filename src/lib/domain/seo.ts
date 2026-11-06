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
 * Crawlers that collect text and images to train AI models. Writers' stories are theirs, so these
 * are asked to stay out entirely. Search engines (Googlebot, Bingbot), link-preview fetchers and
 * AI search/answer tools that link back (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-User…)
 * are not on this list. Google-Extended and Applebot-Extended only opt out of AI training; search
 * indexing by Google and Apple carries on.
 */
export const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Bytespider",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "AI2Bot",
  "Omgilibot",
  "ImagesiftBot",
  "Timpibot",
  "PanguBot",
] as const;

/**
 * robots.txt: the public site lets everything be crawled except private areas and APIs (share
 * images stay reachable, since X and others honor robots.txt when fetching them), and AI training
 * crawlers are turned away from all of it. Previews and local builds ask every crawler to stay out.
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
      { userAgent: [...AI_TRAINING_CRAWLERS], disallow: ["/"] },
    ],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}

/**
 * The text-and-data-mining opt-out (W3C TDM Reservation Protocol): every response says rights are
 * reserved, which is the machine-readable reservation EU copyright law (DSM Directive, art. 4)
 * asks for. `noai`/`noimageai` is the informal equivalent some image and text crawlers honor.
 */
export const RIGHTS_RESERVED_HEADERS = [
  { key: "tdm-reservation", value: "1" },
  { key: "X-Robots-Tag", value: "noai, noimageai" },
] as const;

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
