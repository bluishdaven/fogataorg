import { z } from "zod";
import { LOCALES } from "./locale";

export const EMAIL_FREQUENCIES = ["off", "daily", "weekly"] as const;
export type EmailFrequency = (typeof EMAIL_FREQUENCIES)[number];

export const emailFrequencyInputSchema = z.object({
  frequency: z.enum(EMAIL_FREQUENCIES),
});

export const unsubscribeInputSchema = z.object({
  token: z.string().min(1).max(200),
  locale: z.enum(LOCALES),
});

export type EmailSettingsResult = { ok: true } | { ok: false; error: "unauthorized" | "invalid" };
