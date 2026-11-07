import { z } from "zod";

/** Deleting an account needs the username typed back, so it can't happen by accident. */
export const deleteAccountSchema = z.object({
  confirm: z.string().trim().min(1).max(60),
  locale: z.enum(["en", "es"]),
});

export function confirmsUsername(typed: string, username: string): boolean {
  return typed.trim().replace(/^@/, "").toLowerCase() === username.toLowerCase();
}

export type DeleteAccountResult = { ok: false; error: "unauthorized" | "mismatch" | "failed" };
