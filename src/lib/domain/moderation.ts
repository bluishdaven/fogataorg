import { z } from "zod";

export const MODERATION_STATUSES = ["nsfw", "removed"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
export const MODERATION_REASON_MAX = 300;

/** Mark a story NSFW or remove it (a public reason is required), or lift moderation (status null). */
export const moderateStorySchema = z
  .object({
    storyId: z.uuid(),
    status: z.enum(MODERATION_STATUSES).nullable(),
    reason: z.string().trim().max(MODERATION_REASON_MAX).default(""),
  })
  .refine((input) => input.status === null || input.reason.length > 0, { message: "reasonRequired", path: ["reason"] });

export type ModerationResult = { ok: true } | { ok: false; error: "unauthorized" | "reasonRequired" | "failed" };
