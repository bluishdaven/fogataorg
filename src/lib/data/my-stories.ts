import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { prompts, stories, storyTopics, topics } from "@/lib/db/schema";
import type { TiptapDoc } from "@/lib/domain/content";
import { pendingChangesSchema } from "@/lib/domain/stories";
import { moderationReasonSql, moderationStatusSql } from "./moderation-sql";

/**
 * A writer's own stories. Runs as the signed-in writer, so RLS returns only
 * their rows (drafts included). Never cached across users.
 */

export type EditorStory = Awaited<ReturnType<typeof getStoryForEditing>> & {};

export async function getStoryForEditing(viewer: Viewer, id: string) {
  return withRls(viewer.claims, async (tx) => {
    const [story] = await tx
      .select()
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .limit(1);
    if (!story) return null;

    const topicRows = await tx
      .select({ slug: topics.slug })
      .from(storyTopics)
      .innerJoin(topics, eq(topics.id, storyTopics.topicId))
      .where(eq(storyTopics.storyId, id));

    const [prompt] = story.promptId
      ? await tx.select({ textEn: prompts.textEn, textEs: prompts.textEs }).from(prompts).where(eq(prompts.id, story.promptId)).limit(1)
      : [];

    const pending = pendingChangesSchema.safeParse(story.pendingChanges);
    const working = pending.success ? pending.data : null;

    return {
      id: story.id,
      status: story.status,
      slug: story.slug,
      language: story.language,
      revision: story.revision,
      publishedAt: story.publishedAt,
      updatedAt: story.updatedAt,
      // What the editor shows: pending edits for published stories, else the story itself.
      title: working?.title ?? story.title,
      subtitle: working?.subtitle ?? story.subtitle,
      content: (working?.content ?? story.content) as TiptapDoc,
      hasPendingChanges: Boolean(working),
      cover: story.coverUrl ? { url: story.coverUrl, alt: story.coverAlt, credit: story.coverCredit ?? null } : null,
      accentColor: story.accentColor,
      seoTitle: story.seoTitle,
      seoDescription: story.seoDescription,
      canonicalUrl: story.canonicalUrl ?? "",
      topics: topicRows.map((t) => t.slug),
      prompt: prompt ?? null,
    };
  });
}

export async function listMyStories(viewer: Viewer) {
  return withRls(viewer.claims, (tx) =>
    tx
      .select({
        id: stories.id,
        title: stories.title,
        subtitle: stories.subtitle,
        slug: stories.slug,
        status: stories.status,
        language: stories.language,
        publishedAt: stories.publishedAt,
        updatedAt: stories.updatedAt,
        readingTime: stories.readingTime,
        pendingChanges: stories.pendingChanges,
        moderation: moderationStatusSql,
        moderationReason: moderationReasonSql,
      })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .orderBy(desc(stories.updatedAt)),
  );
}

export async function listTopics() {
  "use cache";
  cacheLife("days");
  cacheTag("topics");
  return asAnon((tx) =>
    tx.select({ slug: topics.slug, nameEn: topics.nameEn, nameEs: topics.nameEs }).from(topics).orderBy(topics.slug),
  );
}
