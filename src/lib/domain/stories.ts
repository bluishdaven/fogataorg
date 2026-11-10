import { z } from "zod";
import { localeSchema, MAX_TOPICS_PER_STORY } from "./schemas";
import { imageCreditSchema } from "./unsplash";

/**
 * Rules for writing and publishing stories. Error messages are message keys
 * under `Publish.errors` / `Editor.errors`.
 */

export const STORY_TITLE_MAX = 200;
export const STORY_SUBTITLE_MAX = 280;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;
export const MIN_WORDS_TO_PUBLISH = 20;

export const storyIdSchema = z.uuid();

export const saveDraftSchema = z.object({
  id: storyIdSchema,
  revision: z.number().int().min(0),
  title: z.string().max(STORY_TITLE_MAX),
  subtitle: z.string().max(STORY_SUBTITLE_MAX),
  content: z.unknown(),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export type SaveDraftResult =
  | { ok: true; revision: number; savedAt: string }
  | { ok: false; error: "unauthorized" | "not_found" | "conflict" | "invalid" | "too_large" | "unsafe_image" };

const topicSlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const coverSchema = z.object({
  url: z.url().max(2048),
  alt: z.string().trim().min(1, { message: "coverAlt" }).max(300, { message: "coverAlt" }),
  credit: imageCreditSchema.nullable(),
});

/** A story's optional color: a hex like a circle's accent, stored in lowercase. */
export const storyAccentSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())
  .nullable();

export const publishSchema = z.object({
  id: storyIdSchema,
  cover: coverSchema.nullable(),
  accentColor: storyAccentSchema.default(null),
  topics: z
    .array(topicSlugSchema)
    .max(MAX_TOPICS_PER_STORY, { message: "tooManyTopics" })
    .transform((list) => [...new Set(list)]),
  language: localeSchema,
  seoTitle: z.string().trim().max(SEO_TITLE_MAX, { message: "seoTitle" }),
  seoDescription: z.string().trim().max(SEO_DESCRIPTION_MAX, { message: "seoDescription" }),
  canonicalUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https:\/\/[^\s]+$/.test(value), { message: "canonicalUrl" })
    .refine((value) => {
      if (value === "") return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, { message: "canonicalUrl" }),
  visibility: z.enum(["public", "unlisted"]),
  /** ISO timestamp to publish later, or null for now. */
  publishAt: z.iso.datetime({ offset: true }).nullable(),
});
export type PublishInput = z.input<typeof publishSchema>;

export type PublishErrorKey =
  | "unauthorized"
  | "rateLimited"
  | "not_found"
  | "titleRequired"
  | "tooShort"
  | "imageAlt"
  | "coverAlt"
  | "unsafeImage"
  | "tooManyTopics"
  | "unknownTopic"
  | "seoTitle"
  | "seoDescription"
  | "canonicalUrl"
  | "scheduleInPast"
  | "invalid";

export type PublishResult = { ok: true; path: string; scheduled: boolean } | { ok: false; errors: PublishErrorKey[] };

/** Changes to a published story, kept aside until the writer publishes them. */
export const pendingChangesSchema = z.object({
  title: z.string().max(STORY_TITLE_MAX),
  subtitle: z.string().max(STORY_SUBTITLE_MAX),
  content: z.unknown(),
});
export type PendingChanges = { title: string; subtitle: string; content: unknown };

export type StoryState = "draft" | "scheduled" | "published" | "unlisted";

/** What a writer should see for a story right now. Scheduling = published with a future date. */
export function storyState(
  story: { status: "draft" | "scheduled" | "published" | "unlisted"; publishedAt: Date | null },
  now: Date,
): StoryState {
  if (story.status === "draft") return "draft";
  if (story.publishedAt && story.publishedAt.getTime() > now.getTime()) return "scheduled";
  return story.status === "unlisted" ? "unlisted" : story.status === "scheduled" ? "scheduled" : "published";
}

export function draftSlug(id: string): string {
  return `draft-${id.replace(/-/g, "").slice(0, 12)}`;
}

export function isDraftSlug(slug: string): boolean {
  return /^draft-[0-9a-f]{12}$/.test(slug);
}

/** Public URL prefix for files in our story-images bucket. */
export function storyImagePrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/story-images/`;
}
