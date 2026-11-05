import { z } from "zod";
import { usernameSchema } from "./schemas";
import { safeHref } from "./story-doc";

/**
 * Profile editing rules. Error messages are keys under `Settings.errors`.
 */

export const DISPLAY_NAME_MAX = 80;
export const BIO_MAX = 280;
export const MAX_PROFILE_LINKS = 5;

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
  | "invalid";

export type ProfileUpdateResult = { ok: true; username: string } | { ok: false; errors: ProfileErrorKey[] };
