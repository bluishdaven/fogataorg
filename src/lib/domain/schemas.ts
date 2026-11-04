import { z } from "zod";
import { LOCALES } from "./locale";

/**
 * Zod schemas for every write that crosses a trust boundary. Error messages are
 * message keys under `Validation` in messages/{en,es}.json, so the UI can show
 * them in the reader's language.
 */

export const localeSchema = z.enum(LOCALES);

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, { message: "username" });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { message: "email" })
  .pipe(z.email({ message: "email" }));

export const magicLinkSchema = z.object({
  email: emailSchema,
  locale: localeSchema,
  next: z.string().max(512).optional(),
});
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export const oauthSchema = z.object({
  provider: z.enum(["google"]),
  locale: localeSchema,
  next: z.string().max(512).optional(),
});

export const storyStatusSchema = z.enum(["draft", "scheduled", "published", "unlisted"]);

export const MAX_TOPICS_PER_STORY = 5;
