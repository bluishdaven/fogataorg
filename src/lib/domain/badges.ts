import { z } from "zod";

/**
 * Writing tiers by published, public stories (docs/plans/badges.md). Each step asks for roughly
 * double the last; names climb from fire on the ground to light in the sky. Recognition only:
 * badges never unlock features.
 */
export const WRITING_TIERS = [
  { key: "kindling", min: 1 },
  { key: "candle", min: 5 },
  { key: "flame", min: 12 },
  { key: "torch", min: 25 },
  { key: "hearth", min: 50 },
  { key: "bonfire", min: 100 },
  { key: "beacon", min: 200 },
  { key: "star", min: 350 },
  { key: "sun", min: 600 },
  { key: "phoenix", min: 1000 },
] as const;

export type WritingTier = (typeof WRITING_TIERS)[number];
export type WritingTierKey = WritingTier["key"];

/** The highest tier reached, or null before the first story. */
export function writingTier(publishedStories: number): WritingTier | null {
  let reached: WritingTier | null = null;
  for (const tier of WRITING_TIERS) if (publishedStories >= tier.min) reached = tier;
  return reached;
}

/** What badge components need about a person. */
export type BadgeData = { stories: number; donor: boolean };

export function badgeData(row: { publishedCount: number | null | undefined; donorSince: Date | string | null | undefined }): BadgeData {
  return { stories: Number(row.publishedCount ?? 0), donor: row.donorSince != null };
}

export const donorGrantSchema = z.object({
  /** @username or the email the account signs in with. */
  target: z.string().trim().min(1).max(320),
  note: z.string().trim().max(500).default(""),
});

export const donorRemoveSchema = z.object({ userId: z.uuid() });

export type DonorActionResult =
  | { ok: true; name: string }
  | { ok: false; error: "unauthorized" | "invalid" | "notFound" };

/** Admins are marked in Supabase app_metadata (settable only from the dashboard or service key). */
export function isAdminClaims(claims: unknown): boolean {
  if (!claims || typeof claims !== "object") return false;
  const meta = (claims as { app_metadata?: unknown }).app_metadata;
  return !!meta && typeof meta === "object" && (meta as { role?: unknown }).role === "admin";
}
