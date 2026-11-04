import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

/**
 * Locale comes from the `[locale]` root param. Server actions and route
 * handlers can't read root params, so they pass `locale` explicitly
 * (e.g. `getTranslations({ locale, namespace })`).
 */
export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    // Dates render in UTC until readers can set a time zone (Phase 3 onboarding).
    timeZone: "UTC",
  };
});
