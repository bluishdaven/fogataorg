import { z } from "zod";
import { slugify } from "./slug";
import { imageCreditSchema } from "./unsplash";

/** Circle rules. Error messages are keys under `Circles.errors`. */

export const CIRCLE_NAME_MAX = 60;
export const CIRCLE_DESCRIPTION_MAX = 280;

/** Starting palette for accents; any hex works as long as text stays readable (we pick it). */
export const ACCENT_PRESETS = [
  "#c2410c", // ember
  "#be123c", // rose
  "#7e22ce", // plum
  "#1d4ed8", // lake
  "#0f766e", // teal
  "#15803d", // forest
  "#a16207", // sand
  "#1e293b", // night
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT_TEXT = "#ffffff";
// Pure black: with white as the other option, the better of the two is always ≥ 4.58:1.
// (Near-black like #1d1a16 dips to ~4.35:1 on mid-tone accents.)
const DARK_TEXT = "#000000";

/** Text color for an accent background: whichever of white or black reads better (always ≥ 4.5:1). */
export function readableTextOn(accent: string): string {
  return contrastRatio(accent, LIGHT_TEXT) >= contrastRatio(accent, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

const headerSchema = z
  .object({
    url: z.url().max(2048),
    alt: z.string().trim().min(1, { message: "headerAlt" }).max(300, { message: "headerAlt" }),
    credit: imageCreditSchema.nullable(),
  })
  .nullable();

const circleFields = {
  name: z.string().trim().min(2, { message: "name" }).max(CIRCLE_NAME_MAX, { message: "name" }),
  description: z.string().trim().max(CIRCLE_DESCRIPTION_MAX, { message: "description" }),
  accentColor: z
    .string()
    .regex(HEX, { message: "accent" })
    .transform((value) => value.toLowerCase()),
  header: headerSchema,
  /** Private: only members publish; everyone else can ask to join. Anyone can still read. */
  isPrivate: z.boolean().default(false),
};

export const createCircleSchema = z
  .object({
    ...circleFields,
    slug: z.string().trim().max(60).optional(),
  })
  .transform((value, ctx) => {
    const slug = slugify(value.slug?.trim() || value.name, 40);
    if (slug.length < 3) {
      ctx.addIssue({ code: "custom", message: "slug", path: ["slug"] });
      return z.NEVER;
    }
    return { ...value, slug };
  });
export type CreateCircleInput = z.input<typeof createCircleSchema>;

export const updateCircleSchema = z.object({ circleId: z.uuid(), ...circleFields });
export type UpdateCircleInput = z.input<typeof updateCircleSchema>;

export const addMemberSchema = z.object({
  circleId: z.uuid(),
  username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().regex(/^[A-Za-z0-9_]{3,30}$/, { message: "username" })),
  role: z.enum(["editor", "writer"]),
});

export const submissionSchema = z.object({ circleId: z.uuid(), storyId: z.uuid() });
export const DECLINE_NOTE_MAX = 500;
/** Accepting or declining a submission; a declined one may carry a short note to the writer. */
export const decisionSchema = z
  .object({
    submissionId: z.uuid(),
    status: z.enum(["accepted", "declined"]),
    note: z
      .string()
      .trim()
      .max(DECLINE_NOTE_MAX)
      .optional()
      .transform((value) => value || null),
  })
  .refine((value) => value.status === "declined" || value.note === null, { message: "invalid" });
export const joinRequestSchema = z.object({ circleId: z.uuid() });
/** The owner hands the circle to another member. */
export const transferCircleSchema = z.object({ circleId: z.uuid(), userId: z.uuid() });
/** Deleting needs the circle's name typed back, so it can't happen by accident. */
export const deleteCircleSchema = z.object({ circleId: z.uuid(), confirmName: z.string().max(200) });

/** Whether the typed name matches the circle's (ignoring case and surrounding spaces). */
export function confirmsCircleName(typed: string, name: string): boolean {
  return typed.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && typed.trim() !== "";
}
export const joinDecisionSchema = z.object({ requestId: z.uuid(), accept: z.boolean() });

export type CircleErrorKey =
  | "unauthorized"
  | "not_allowed"
  | "name"
  | "slug"
  | "slugTaken"
  | "description"
  | "accent"
  | "headerAlt"
  | "unsafeImage"
  | "username"
  | "userNotFound"
  | "alreadyMember"
  | "alreadySubmitted"
  | "alreadyRequested"
  | "rateLimited"
  | "confirmName"
  | "invalid";
