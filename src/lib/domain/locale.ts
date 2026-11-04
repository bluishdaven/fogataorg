/**
 * Locale rules shared by the proxy, i18n config and data layer.
 * Spanish and English are equal citizens; English is only the fallback.
 */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Parses an Accept-Language header into language tags ordered by preference.
 * Entries with q=0 are dropped; malformed entries are ignored.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry) => entry.tag.length > 0 && entry.tag !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.tag);
}

/**
 * Picks the UI locale for a request: explicit cookie choice first, then the
 * browser's Accept-Language (matching on the primary subtag, so es-MX → es),
 * then the default.
 */
export function resolveLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/**
 * Path to load when the reader switches language. Prefixed UI paths swap the
 * prefix; share URLs (/@handle…) stay as they are, since the locale cookie
 * decides their UI language.
 */
export function pathForLocale(pathname: string, locale: Locale): string {
  if (pathname.startsWith("/@")) return pathname;
  const rest = pathname.replace(/^\/(en|es)(?=\/|$)/, "");
  return `/${locale}${rest === "/" ? "" : rest}`;
}
