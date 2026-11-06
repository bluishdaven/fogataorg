import { z } from "zod";
import { usernameSchema } from "./schemas";
import { safeHref } from "./story-doc";

/**
 * Profile editing rules. Error messages are keys under `Settings.errors`.
 */

export const DISPLAY_NAME_MAX = 80;
export const BIO_MAX = 280;
export const MAX_PROFILE_LINKS = 5;
export const PRONOUNS_MAX = 40;
export const NOW_TEXT_MAX = 120;
export const INFLUENCES_PER_KIND = 5;
export const INFLUENCE_MAX = 80;

export const NOW_FOCUSES = ["reading", "watching", "listening"] as const;
export type NowFocus = (typeof NOW_FOCUSES)[number];

export const INFLUENCE_KINDS = ["books", "movies", "music", "politics"] as const;
export type InfluenceKind = (typeof INFLUENCE_KINDS)[number];
export type Influences = Partial<Record<InfluenceKind, string[]>>;

/** One entry per line or item: trimmed, blanks and repeats (ignoring case) dropped. */
function cleanEntries(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/\s+/g, " ").trim();
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const influenceListSchema = z
  .array(z.string().max(INFLUENCE_MAX * 2))
  .max(INFLUENCES_PER_KIND * 4)
  .transform(cleanEntries)
  .refine((list) => list.length <= INFLUENCES_PER_KIND, { message: "tooManyInfluences" })
  .refine((list) => list.every((item) => item.length <= INFLUENCE_MAX), { message: "influence" });

/** What people may save; empty kinds are left out. */
export const influencesSchema = z
  .object(Object.fromEntries(INFLUENCE_KINDS.map((kind) => [kind, influenceListSchema.optional()])) as Record<
    InfluenceKind,
    z.ZodOptional<typeof influenceListSchema>
  >)
  .transform((value) => {
    const out: Influences = {};
    for (const kind of INFLUENCE_KINDS) {
      const list = value[kind];
      if (list?.length) out[kind] = list;
    }
    return out;
  });

/**
 * Reads stored influences for display. Rows can be written through the Data API, so anything that
 * doesn't fit the rules is dropped rather than shown.
 */
export function readInfluences(stored: unknown): Influences {
  if (!stored || typeof stored !== "object") return {};
  const out: Influences = {};
  for (const kind of INFLUENCE_KINDS) {
    const list = (stored as Record<string, unknown>)[kind];
    if (!Array.isArray(list)) continue;
    const clean = cleanEntries(list.filter((item): item is string => typeof item === "string")).filter(
      (item) => item.length <= INFLUENCE_MAX,
    );
    if (clean.length) out[kind] = clean.slice(0, INFLUENCES_PER_KIND);
  }
  return out;
}

/** Handles that would confuse readers or impersonate the platform. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "fogata",
  "fogataorg",
  "help",
  "moderator",
  "official",
  "root",
  "settings",
  "staff",
  "support",
  "system",
]);

export const profileLinkSchema = z.object({
  label: z.string().trim().min(1, { message: "linkLabel" }).max(40, { message: "linkLabel" }),
  url: z
    .string()
    .trim()
    .max(300, { message: "linkUrl" })
    .transform((value) => (/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      const href = safeHref(value);
      return href !== null && /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(href);
    }, { message: "linkUrl" })
    .transform((value) => safeHref(value) ?? value),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(DISPLAY_NAME_MAX, { message: "displayName" }),
  username: usernameSchema.refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), { message: "usernameReserved" }),
  bio: z.string().trim().max(BIO_MAX, { message: "bio" }),
  links: z.array(profileLinkSchema).max(MAX_PROFILE_LINKS, { message: "tooManyLinks" }),
  pronouns: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(PRONOUNS_MAX, { message: "pronouns" }))
    .default(""),
  nowFocus: z.enum(NOW_FOCUSES).default("reading"),
  nowText: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(NOW_TEXT_MAX, { message: "nowText" }))
    .default(""),
  influences: influencesSchema.default({}),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export type ProfileErrorKey =
  | "unauthorized"
  | "displayName"
  | "username"
  | "usernameReserved"
  | "usernameTaken"
  | "bio"
  | "linkLabel"
  | "linkUrl"
  | "tooManyLinks"
  | "pronouns"
  | "nowText"
  | "influence"
  | "tooManyInfluences"
  | "invalid";

export type ProfileUpdateResult = { ok: true; username: string } | { ok: false; errors: ProfileErrorKey[] };
