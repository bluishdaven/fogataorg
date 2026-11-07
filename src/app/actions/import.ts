"use server";

import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { stories } from "@/lib/db/schema";
import { readingTimeMinutes, tiptapToText, type TiptapNode } from "@/lib/domain/content";
import { LOCALES } from "@/lib/domain/locale";
import { draftSlug, STORY_SUBTITLE_MAX, STORY_TITLE_MAX } from "@/lib/domain/stories";
import { sanitizeStoryDoc, StoryDocError } from "@/lib/domain/story-doc";
import { fetchImportImage } from "@/lib/import/copy-image";
import { allowAction } from "@/lib/limits";
import { allowedImagePrefixes, isAllowedStoryImage } from "@/lib/story-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_IMAGES = 25;

const importSchema = z.object({
  title: z.string().trim().max(STORY_TITLE_MAX),
  subtitle: z.string().trim().max(STORY_SUBTITLE_MAX),
  language: z.enum(LOCALES),
  canonicalUrl: z.url({ protocol: /^https$/ }).max(500).nullable(),
  doc: z.object({ type: z.literal("doc"), content: z.array(z.unknown()).max(5_000) }),
});

export type ImportStoryResult =
  | { ok: true; id: string; images: { copied: number; failed: number } }
  | { ok: false; error: "unauthorized" | "invalid" | "tooLarge" | "rateLimited" };

/**
 * Saves one imported post as a draft. Pictures are copied into the writer's own folder first
 * (pictures that can't be copied become a link to the original); then the usual sanitizer runs.
 * Nothing is published or announced.
 */
export async function importStory(input: unknown): Promise<ImportStoryResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  if (!(await allowAction(viewer, "importStory"))) return { ok: false, error: "rateLimited" };
  const { title, subtitle, language, canonicalUrl } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const bucket = supabase.storage.from("story-images");
  let copied = 0;
  let failed = 0;
  const content: TiptapNode[] = [];
  for (const raw of parsed.data.doc.content as TiptapNode[]) {
    const src = raw?.type === "figure" ? raw.attrs?.src : null;
    if (typeof src !== "string" || isAllowedStoryImage(src)) {
      content.push(raw);
      continue;
    }
    const image = copied + failed < MAX_IMAGES ? await fetchImportImage(src) : null;
    const path = `${viewer.id}/${crypto.randomUUID()}.webp`;
    const uploaded =
      image && !(await bucket.upload(path, image.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false })).error;
    if (image && uploaded) {
      copied += 1;
      content.push({ ...raw, attrs: { ...raw.attrs, src: bucket.getPublicUrl(path).data.publicUrl, width: image.width, height: image.height } });
    } else {
      failed += 1;
      const label = typeof raw.attrs?.alt === "string" && raw.attrs.alt ? raw.attrs.alt : new URL(src).host;
      content.push({ type: "paragraph", attrs: raw.attrs?.id ? { id: raw.attrs.id } : {}, content: [{ type: "text", text: `🖼 ${label}`, marks: [{ type: "link", attrs: { href: src } }] }] });
    }
  }

  let doc;
  try {
    doc = sanitizeStoryDoc({ type: "doc", content }, allowedImagePrefixes());
  } catch (error) {
    if (error instanceof StoryDocError) return { ok: false, error: error.reason === "invalid" ? "invalid" : "tooLarge" };
    throw error;
  }
  const text = tiptapToText(doc);
  const id = crypto.randomUUID();
  await withRls(viewer.claims, (tx) =>
    tx.insert(stories).values({
      id,
      authorId: viewer.id,
      title,
      subtitle,
      slug: draftSlug(id),
      language,
      status: "draft",
      content: doc,
      contentText: text,
      readingTime: readingTimeMinutes(text, language),
      canonicalUrl,
    }),
  );
  return { ok: true, id, images: { copied, failed } };
}
