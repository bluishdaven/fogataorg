"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { stories, storyTopics, topics } from "@/lib/db/schema";
import { countWords, readingTimeMinutes, tiptapToText, type TiptapDoc } from "@/lib/domain/content";
import { storyPath } from "@/lib/domain/handle-routes";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/domain/locale";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import { figuresOf, sanitizeStoryDoc, StoryDocError } from "@/lib/domain/story-doc";
import {
  draftSlug,
  isDraftSlug,
  MIN_WORDS_TO_PUBLISH,
  pendingChangesSchema,
  publishSchema,
  saveDraftSchema,
  storyIdSchema,
  type PublishErrorKey,
  type PublishInput,
  type PublishResult,
  type SaveDraftInput,
  type SaveDraftResult,
} from "@/lib/domain/stories";
import { allowedImagePrefixes, isAllowedStoryImage } from "@/lib/story-images";

function localeOf(value: FormDataEntryValue | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Every cache entry a story change can affect. */
function invalidateStoryCaches(username: string, slug: string, topicSlugs: string[] = []) {
  const handle = username.toLowerCase();
  updateTag("stories");
  updateTag(`story:${handle}/${slug}`);
  updateTag(`profile:${handle}`);
  for (const topic of topicSlugs) updateTag(`topic:${topic}`);
}

export async function createDraft(formData: FormData): Promise<void> {
  const locale = localeOf(formData.get("locale"));
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/me/stories`)}`);

  const id = crypto.randomUUID();
  await withRls(viewer.claims, (tx) =>
    tx.insert(stories).values({ id, authorId: viewer.id, title: "", slug: draftSlug(id), language: locale, status: "draft" }),
  );
  redirect(`/${locale}/write/${id}`);
}

export async function saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "unauthorized" };
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  let content: TiptapDoc;
  try {
    content = sanitizeStoryDoc(parsed.data.content, allowedImagePrefixes());
  } catch (error) {
    if (error instanceof StoryDocError) {
      return { ok: false, error: error.reason === "unsafe_image" ? "unsafe_image" : error.reason === "invalid" ? "invalid" : "too_large" };
    }
    throw error;
  }

  const { id, revision, title, subtitle } = parsed.data;
  return withRls(viewer.claims, async (tx): Promise<SaveDraftResult> => {
    const [current] = await tx
      .select({ status: stories.status, revision: stories.revision, language: stories.language })
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .limit(1);
    if (!current) return { ok: false, error: "not_found" };
    if (current.revision !== revision) return { ok: false, error: "conflict" };

    const text = tiptapToText(content);
    const changes =
      current.status === "draft"
        ? { title, subtitle, content, contentText: text, readingTime: readingTimeMinutes(text, current.language) }
        : { pendingChanges: { title, subtitle, content } };

    const [row] = await tx
      .update(stories)
      .set({ ...changes, revision: sql`${stories.revision} + 1` })
      .where(and(eq(stories.id, id), eq(stories.revision, revision)))
      .returning({ revision: stories.revision, updatedAt: stories.updatedAt });
    if (!row) return { ok: false, error: "conflict" };
    return { ok: true, revision: row.revision, savedAt: row.updatedAt.toISOString() };
  });
}

export async function publishStory(input: PublishInput): Promise<PublishResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) {
    const keys = new Set<PublishErrorKey>(
      parsed.error.issues.map((issue) =>
        ["coverAlt", "tooManyTopics", "seoTitle", "seoDescription", "canonicalUrl"].includes(issue.message)
          ? (issue.message as PublishErrorKey)
          : "invalid",
      ),
    );
    return { ok: false, errors: [...keys] };
  }
  const data = parsed.data;
  const now = new Date();

  const result = await withRls(viewer.claims, async (tx) => {
    const [story] = await tx
      .select()
      .from(stories)
      .where(and(eq(stories.id, data.id), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .limit(1);
    if (!story) return { ok: false as const, errors: ["not_found" as const] };

    // Publish what the writer is looking at: pending edits for live stories, else the draft.
    const pending = pendingChangesSchema.safeParse(story.pendingChanges);
    const source = story.status !== "draft" && pending.success ? pending.data : story;

    const errors: PublishErrorKey[] = [];
    let content: TiptapDoc = { type: "doc", content: [] };
    try {
      content = sanitizeStoryDoc(source.content, allowedImagePrefixes());
    } catch {
      errors.push("unsafeImage");
    }
    const title = source.title.trim();
    const text = tiptapToText(content);
    if (!title) errors.push("titleRequired");
    if (countWords(text) < MIN_WORDS_TO_PUBLISH) errors.push("tooShort");
    if (figuresOf(content).some((figure) => !figure.alt)) errors.push("imageAlt");
    if (data.cover && !isAllowedStoryImage(data.cover.url)) errors.push("unsafeImage");

    const firstFigure = figuresOf(content)[0];
    const thumbnail = data.cover
      ? { url: data.cover.url, alt: data.cover.alt }
      : firstFigure
        ? { url: firstFigure.src, alt: firstFigure.alt }
        : null;

    const publishAt = data.publishAt ? new Date(data.publishAt) : null;
    if (publishAt && publishAt.getTime() < now.getTime() - 60_000) errors.push("scheduleInPast");

    const topicRows = data.topics.length
      ? await tx.select({ id: topics.id, slug: topics.slug }).from(topics).where(inArray(topics.slug, data.topics))
      : [];
    if (topicRows.length !== data.topics.length) errors.push("unknownTopic");
    if (errors.length) return { ok: false as const, errors: [...new Set(errors)] };

    const slug = isDraftSlug(story.slug)
      ? await uniqueSlug(slugify(title) || "story", async (candidate) => {
          const [taken] = await tx
            .select({ id: stories.id })
            .from(stories)
            .where(and(eq(stories.authorId, viewer.id), eq(stories.slug, candidate), ne(stories.id, story.id)))
            .limit(1);
          return Boolean(taken);
        })
      : story.slug;

    // Keep the original date when republishing; "now" replaces a date that hasn't arrived yet.
    const publishedAt =
      publishAt ?? (story.publishedAt && story.publishedAt.getTime() <= now.getTime() ? story.publishedAt : now);

    await tx
      .update(stories)
      .set({
        title,
        subtitle: source.subtitle.trim(),
        content,
        contentText: text,
        readingTime: readingTimeMinutes(text, data.language),
        language: data.language,
        status: data.visibility === "unlisted" ? "unlisted" : "published",
        publishedAt,
        slug,
        coverUrl: data.cover?.url ?? null,
        coverAlt: data.cover?.alt ?? "",
        coverCredit: data.cover?.credit ?? null,
        thumbnailUrl: thumbnail?.url ?? null,
        thumbnailAlt: thumbnail?.alt ?? "",
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        canonicalUrl: data.canonicalUrl || null,
        pendingChanges: null,
        revision: sql`${stories.revision} + 1`,
      })
      .where(eq(stories.id, story.id));

    const previousTopics = await tx
      .select({ slug: topics.slug })
      .from(storyTopics)
      .innerJoin(topics, eq(topics.id, storyTopics.topicId))
      .where(eq(storyTopics.storyId, story.id));
    await tx.delete(storyTopics).where(eq(storyTopics.storyId, story.id));
    if (topicRows.length) {
      await tx.insert(storyTopics).values(topicRows.map((topic) => ({ storyId: story.id, topicId: topic.id })));
    }

    return {
      ok: true as const,
      slug,
      scheduled: publishedAt.getTime() > now.getTime(),
      topicSlugs: [...new Set([...previousTopics.map((t) => t.slug), ...data.topics])],
    };
  });

  if (!result.ok) return result;
  invalidateStoryCaches(viewer.username, result.slug, result.topicSlugs);
  return { ok: true, path: storyPath(viewer.username, result.slug), scheduled: result.scheduled };
}

async function changeStory(
  id: string,
  apply: (story: typeof stories.$inferSelect) => Partial<typeof stories.$inferInsert>,
): Promise<{ ok: boolean; wasLive?: boolean }> {
  const viewer = await getViewer();
  if (!viewer || !storyIdSchema.safeParse(id).success) return { ok: false };
  const result = await withRls(viewer.claims, async (tx) => {
    const [story] = await tx
      .select()
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .limit(1);
    if (!story) return null;
    await tx
      .update(stories)
      .set({ ...apply(story), revision: sql`${stories.revision} + 1` })
      .where(eq(stories.id, id));
    const topicRows = await tx
      .select({ slug: topics.slug })
      .from(storyTopics)
      .innerJoin(topics, eq(topics.id, storyTopics.topicId))
      .where(eq(storyTopics.storyId, id));
    return { slug: story.slug, wasLive: story.status !== "draft", topics: topicRows.map((t) => t.slug) };
  });
  if (!result) return { ok: false };
  if (result.wasLive) invalidateStoryCaches(viewer.username, result.slug, result.topics);
  return { ok: true, wasLive: result.wasLive };
}

/** Takes a story off the site; pending edits become the draft. */
export async function unpublishStory(id: string): Promise<{ ok: boolean }> {
  return changeStory(id, (story) => {
    const pending = pendingChangesSchema.safeParse(story.pendingChanges);
    return pending.success
      ? {
          status: "draft",
          title: pending.data.title,
          subtitle: pending.data.subtitle,
          content: pending.data.content as TiptapDoc,
          contentText: tiptapToText(pending.data.content as TiptapDoc),
          pendingChanges: null,
        }
      : { status: "draft" };
  });
}

/** Throws away unpublished edits to a live story. */
export async function discardPendingChanges(id: string): Promise<{ ok: boolean }> {
  return changeStory(id, () => ({ pendingChanges: null }));
}

/** Soft delete. The story disappears for everyone, including its writer. */
export async function deleteStory(formData: FormData): Promise<void> {
  const locale = localeOf(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  await changeStory(id, () => ({ deletedAt: new Date() }));
  redirect(`/${locale}/me/stories`);
}
