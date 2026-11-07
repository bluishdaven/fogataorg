import { z } from "zod";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./locale";
import { safeNextPath } from "./redirect";

export const MIN_TOPICS = 3;
export const MAX_TOPICS = 20;
export const ONBOARDING_STEPS = ["languages", "topics", "writers"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function parseStep(value: unknown): OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value)
    ? (value as OnboardingStep)
    : "languages";
}

const locale = z.enum(LOCALES);

export const languagesSchema = z.object({
  locale,
  readingLanguages: z
    .array(locale)
    .transform((list) => [...new Set(list)])
    .pipe(z.array(locale).min(1, "readingLanguages").max(2)),
});

export const topicsSchema = z.object({
  topics: z
    .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
    .transform((list) => [...new Set(list)])
    .pipe(z.array(z.string()).min(MIN_TOPICS, "tooFewTopics").max(MAX_TOPICS)),
});

/** The locale a path lives under (/es/…), if any. */
export function localeOfPath(path: string): Locale | null {
  const first = path.split("/")[1];
  return isLocale(first) ? first : null;
}

/** Where someone who hasn't onboarded goes after signing in; `next` is where they were headed. */
export function welcomePath(next: string, fallbackLocale: Locale = DEFAULT_LOCALE): string {
  const safe = safeNextPath(next, "/");
  const locale = localeOfPath(safe) ?? fallbackLocale;
  const isHome = safe === "/" || safe === `/${locale}`;
  return isHome ? `/${locale}/welcome` : `/${locale}/welcome?next=${encodeURIComponent(safe)}`;
}

/** Same welcome flow in another UI language (after picking it in step one). */
export function swapLocale(path: string, to: Locale): string {
  const current = localeOfPath(path);
  return current ? `/${to}${path.slice(current.length + 1)}` : path;
}
