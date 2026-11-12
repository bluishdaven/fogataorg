import { z } from "zod";

export const PROMPT_TEXT_MAX = 280;

/** True for a YYYY-MM-DD date that falls on a Monday (UTC), when weekly sparks start. */
export function isMonday(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date) && parsed.getUTCDay() === 1;
}

/** The Monday (UTC) of the week `date` is in, as YYYY-MM-DD. */
export function mondayOf(date: Date): string {
  const day = (date.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day)).toISOString().slice(0, 10);
}

export const promptInputSchema = z.object({
  weekOf: z.string().refine(isMonday, "weekOf"),
  textEn: z.string().trim().min(1, "text").max(PROMPT_TEXT_MAX, "text"),
  textEs: z.string().trim().min(1, "text").max(PROMPT_TEXT_MAX, "text"),
});

export function promptText(prompt: { textEn: string; textEs: string }, locale: string): string {
  return locale === "es" ? prompt.textEs : prompt.textEn;
}

/** A spark features at most this many entries (the database enforces it too). */
export const MAX_FEATURED = 3;

export const featureInputSchema = z.object({
  promptId: z.uuid(),
  storyId: z.uuid(),
  featured: z.boolean(),
});
