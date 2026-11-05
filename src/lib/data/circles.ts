import "server-only";
import { and, count, desc, eq, inArray, isNull, lte, notInArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { Viewer } from "@/lib/auth";
import { asAnon, withRls } from "@/lib/db/rls";
import { circleMembers, circles, circleSubmissions, follows, profiles, stories } from "@/lib/db/schema";
import { badgeData } from "@/lib/domain/badges";
import { excerpt } from "@/lib/domain/content";
import { imageCreditSchema } from "@/lib/domain/unsplash";
import { isAllowedStoryImage } from "@/lib/story-images";
import { donorActiveSql, publishedCountSql } from "./badge-sql";
import { notModerated } from "./moderation-sql";

/**
 * Circles: public reads run as anon and are cached (tags `circles` and
 * `circle:<slug>`); management reads run as the signed-in editor.
 */

const live = and(eq(stories.status, "published"), isNull(stories.deletedAt), lte(stories.publishedAt, sql`now()`));

function header(row: { headerUrl: string | null; headerAlt: string; headerCredit: unknown }) {
  if (!row.headerUrl || !isAllowedStoryImage(row.headerUrl)) return null;
  const credit = imageCreditSchema.safeParse(row.headerCredit);
  return { url: row.headerUrl, alt: row.headerAlt, credit: credit.success ? credit.data : null };
}

export async function listCircles() {
  "use cache";
  cacheLife("minutes");
  cacheTag("circles");
  return asAnon(async (tx) => {
    const rows = await tx
      .select({
        id: circles.id,
        slug: circles.slug,
        name: circles.name,
        description: circles.description,
        accentColor: circles.accentColor,
        stories: sql<number>`(select count(*)::int from public.circle_submissions cs join public.stories s on s.id = cs.story_id where cs.circle_id = "circles"."id" and cs.status = 'accepted' and s.status = 'published' and s.deleted_at is null and s.published_at <= now())`,
        followers: sql<number>`(select count(*)::int from public.follows f where f.followed_circle_id = "circles"."id")`,
      })
      .from(circles)
      .orderBy(desc(circles.createdAt))
      .limit(200);
    return rows;
  });
}

export async function getCircle(slug: string) {
  "use cache";
  cacheTag("circles", "stories", `circle:${slug.toLowerCase()}`);

  const result = await asAnon(async (tx) => {
    const [circle] = await tx.select().from(circles).where(sql`lower(${circles.slug}) = lower(${slug})`).limit(1);
    if (!circle) return null;

    const members = await tx
      .select({
        userId: circleMembers.userId,
        role: circleMembers.role,
        username: profiles.username,
        displayName: profiles.displayName,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
      })
      .from(circleMembers)
      .innerJoin(profiles, eq(profiles.id, circleMembers.userId))
      .where(eq(circleMembers.circleId, circle.id))
      .orderBy(circleMembers.createdAt);

    const rows = await tx
      .select({
        title: stories.title,
        subtitle: stories.subtitle,
        slug: stories.slug,
        language: stories.language,
        readingTime: stories.readingTime,
        publishedAt: stories.publishedAt,
        contentText: sql<string>`left(${stories.contentText}, 400)`,
        thumbnailUrl: stories.thumbnailUrl,
        thumbnailAlt: stories.thumbnailAlt,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
      })
      .from(circleSubmissions)
      .innerJoin(stories, eq(stories.id, circleSubmissions.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(circleSubmissions.circleId, circle.id), eq(circleSubmissions.status, "accepted"), live, notModerated))
      .orderBy(desc(stories.publishedAt))
      .limit(100);

    return {
      id: circle.id,
      slug: circle.slug,
      name: circle.name,
      description: circle.description,
      accentColor: circle.accentColor,
      header: header(circle),
      createdAt: circle.createdAt,
      members: members.map(({ publishedCount, donorActive, ...m }) => ({
        ...m,
        displayName: m.displayName || m.username,
        badges: badgeData({ publishedCount, donorActive }),
      })),
      stories: rows.map((row) => ({
        title: row.title,
        subtitle: row.subtitle,
        slug: row.slug,
        language: row.language,
        readingTime: row.readingTime,
        publishedAt: row.publishedAt,
        excerpt: excerpt(row.contentText),
        thumbnail: row.thumbnailUrl && isAllowedStoryImage(row.thumbnailUrl) ? { url: row.thumbnailUrl, alt: row.thumbnailAlt } : null,
        author: {
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          badges: badgeData(row),
        },
      })),
    };
  });

  if (result) cacheLife("hours");
  else cacheLife("minutes");
  return result;
}

/** The reader's relationship to a circle (role, following) plus follower count. */
export async function getCircleViewerState(viewer: Viewer | null, circleId: string) {
  return withRls(viewer?.claims ?? null, async (tx) => {
    const [followers] = await tx.select({ value: count() }).from(follows).where(eq(follows.followedCircleId, circleId));
    if (!viewer) return { followers: followers?.value ?? 0, following: false, role: null, signedIn: false };
    const [membership] = await tx
      .select({ role: circleMembers.role })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, viewer.id)));
    const [follow] = await tx
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, viewer.id), eq(follows.followedCircleId, circleId)));
    return { followers: followers?.value ?? 0, following: Boolean(follow), role: membership?.role ?? null, signedIn: true };
  });
}

/** The reader's live stories, with any circle they're already in or waiting for. */
export async function listSubmittableStories(viewer: Viewer) {
  return withRls(viewer.claims, async (tx) => {
    const own = await tx
      .select({ id: stories.id, title: stories.title, publishedAt: stories.publishedAt })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.id), live))
      .orderBy(desc(stories.publishedAt))
      .limit(100);
    if (!own.length) return [];
    const active = await tx
      .select({ storyId: circleSubmissions.storyId, status: circleSubmissions.status, circleName: circles.name })
      .from(circleSubmissions)
      .innerJoin(circles, eq(circles.id, circleSubmissions.circleId))
      .where(
        and(
          inArray(
            circleSubmissions.storyId,
            own.map((s) => s.id),
          ),
          notInArray(circleSubmissions.status, ["declined"]),
        ),
      );
    const byStory = new Map(active.map((a) => [a.storyId, a]));
    return own.map((story) => ({ ...story, activeCircle: byStory.get(story.id) ?? null }));
  });
}

/** Everything the manage page needs; null unless the reader is an owner or editor. */
export async function getCircleForManage(viewer: Viewer, slug: string) {
  return withRls(viewer.claims, async (tx) => {
    const [circle] = await tx.select().from(circles).where(sql`lower(${circles.slug}) = lower(${slug})`).limit(1);
    if (!circle) return null;
    const [membership] = await tx
      .select({ role: circleMembers.role })
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, viewer.id)));
    if (!membership || (membership.role !== "owner" && membership.role !== "editor")) return null;

    const members = await tx
      .select({
        userId: circleMembers.userId,
        role: circleMembers.role,
        username: profiles.username,
        displayName: profiles.displayName,
        publishedCount: publishedCountSql(),
        donorActive: donorActiveSql(),
      })
      .from(circleMembers)
      .innerJoin(profiles, eq(profiles.id, circleMembers.userId))
      .where(eq(circleMembers.circleId, circle.id))
      .orderBy(circleMembers.createdAt);

    const submissions = await tx
      .select({
        id: circleSubmissions.id,
        status: circleSubmissions.status,
        createdAt: circleSubmissions.createdAt,
        storyTitle: stories.title,
        storySlug: stories.slug,
        authorUsername: profiles.username,
        authorName: profiles.displayName,
      })
      .from(circleSubmissions)
      .innerJoin(stories, eq(stories.id, circleSubmissions.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(circleSubmissions.circleId, circle.id), isNull(stories.deletedAt)))
      .orderBy(desc(circleSubmissions.updatedAt))
      .limit(200);

    return {
      id: circle.id,
      slug: circle.slug,
      name: circle.name,
      description: circle.description,
      accentColor: circle.accentColor,
      header: header(circle),
      role: membership.role,
      members: members.map(({ publishedCount, donorActive, ...m }) => ({
        ...m,
        displayName: m.displayName || m.username,
        badges: badgeData({ publishedCount, donorActive }),
      })),
      pending: submissions.filter((s) => s.status === "pending"),
      accepted: submissions.filter((s) => s.status === "accepted"),
    };
  });
}
