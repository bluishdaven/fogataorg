import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import {
  bookmarks,
  circleMembers,
  circles,
  follows,
  highlights,
  profiles,
  readingLists,
  responses,
  series,
  sparks,
  stories,
  storyTopics,
  topics,
  userBlocks,
} from "@/lib/db/schema";
import { profilePath, storyPath } from "@/lib/domain/handle-routes";
import { publicEnv } from "@/lib/env";

/**
 * "Download your data": everything a person has on Fogata, as one JSON file. Read with their own
 * session (RLS), so it can only ever contain their rows plus the public stories they reference.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in to download your data", { status: 401 });
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  const data = await withRls(viewer.claims, async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, viewer.id));
    const own = await tx
      .select({
        id: stories.id,
        title: stories.title,
        subtitle: stories.subtitle,
        slug: stories.slug,
        status: stories.status,
        language: stories.language,
        publishedAt: stories.publishedAt,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        canonicalUrl: stories.canonicalUrl,
        coverUrl: stories.coverUrl,
        text: stories.contentText,
        content: stories.content,
      })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.id), isNull(stories.deletedAt)))
      .orderBy(desc(stories.createdAt));
    const topicRows = own.length
      ? await tx
          .select({ storyId: storyTopics.storyId, slug: topics.slug })
          .from(storyTopics)
          .innerJoin(topics, eq(topics.id, storyTopics.topicId))
          .where(inArray(storyTopics.storyId, own.map((s) => s.id)))
      : [];

    // Stories this person touched elsewhere, for readable references.
    const ref = { title: stories.title, slug: stories.slug, author: profiles.username };
    const myResponses = await tx
      .select({ body: responses.body, createdAt: responses.createdAt, isReply: responses.parentId, ...ref })
      .from(responses)
      .innerJoin(stories, eq(stories.id, responses.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(responses.authorId, viewer.id), isNull(responses.deletedAt)));
    const mySparks = await tx
      .select({ count: sparks.count, ...ref })
      .from(sparks)
      .innerJoin(stories, eq(stories.id, sparks.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(eq(sparks.userId, viewer.id));
    const blocks = await tx
      .select({ kind: userBlocks.kind, since: userBlocks.createdAt, username: profiles.username })
      .from(userBlocks)
      .innerJoin(profiles, eq(profiles.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, viewer.id));
    // listName null is the default Saved list.
    const saved = await tx
      .select({ savedAt: bookmarks.createdAt, listName: readingLists.name, ...ref })
      .from(bookmarks)
      .innerJoin(stories, eq(stories.id, bookmarks.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .leftJoin(readingLists, eq(readingLists.id, bookmarks.listId))
      .where(eq(bookmarks.userId, viewer.id));
    const mySeries = await tx
      .select({ id: series.id, title: series.title, slug: series.slug, description: series.description })
      .from(series)
      .where(eq(series.authorId, viewer.id));
    const seriesParts = await tx
      .select({ seriesId: stories.seriesId, position: stories.seriesPosition, title: stories.title })
      .from(stories)
      .where(and(eq(stories.authorId, viewer.id), isNull(stories.deletedAt)));
    const embers = await tx
      .select({ quote: highlights.quote, keptAt: highlights.createdAt, ...ref })
      .from(highlights)
      .innerJoin(stories, eq(stories.id, highlights.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(eq(highlights.userId, viewer.id));
    const followRows = await tx
      .select({ user: profiles.username, topic: topics.slug, circle: circles.slug })
      .from(follows)
      .leftJoin(profiles, eq(profiles.id, follows.followedUserId))
      .leftJoin(topics, eq(topics.id, follows.followedTopicId))
      .leftJoin(circles, eq(circles.id, follows.followedCircleId))
      .where(eq(follows.followerId, viewer.id));
    const memberships = await tx
      .select({ circle: circles.slug, name: circles.name, role: circleMembers.role })
      .from(circleMembers)
      .innerJoin(circles, eq(circles.id, circleMembers.circleId))
      .where(eq(circleMembers.userId, viewer.id));

    const link = (author: string, slug: string) => `${site}${storyPath(author, slug)}`;
    return {
      exportedAt: new Date().toISOString(),
      account: { email: (viewer.claims as { email?: string }).email ?? null, createdAt: profile?.createdAt ?? null },
      profile: profile
        ? {
            url: `${site}${profilePath(profile.username)}`,
            username: profile.username,
            name: profile.displayName,
            bio: profile.bio,
            pronouns: profile.pronouns,
            now: profile.nowText ? { focus: profile.nowFocus, text: profile.nowText } : null,
            influences: profile.influences,
            links: profile.links,
            photo: profile.avatarUrl,
            language: profile.locale,
            emailSummaries: profile.emailFrequency,
          }
        : null,
      stories: own.map(({ id, ...story }) => ({
        ...story,
        url: story.status === "published" || story.status === "unlisted" ? link(viewer.username, story.slug) : null,
        topics: topicRows.filter((t) => t.storyId === id).map((t) => t.slug),
      })),
      responses: myResponses.map((r) => ({ body: r.body, createdAt: r.createdAt, reply: Boolean(r.isReply), story: { title: r.title, url: link(r.author, r.slug) } })),
      sparks: mySparks.map((s) => ({ count: s.count, story: { title: s.title, url: link(s.author, s.slug) } })),
      saved: saved.map((s) => ({ savedAt: s.savedAt, list: s.listName ?? "Saved", story: { title: s.title, url: link(s.author, s.slug) } })),
      series: mySeries.map(({ id, ...item }) => ({
        ...item,
        url: `${site}/@${viewer.username}/series/${item.slug}`,
        parts: seriesParts.filter((part) => part.seriesId === id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((part) => part.title),
      })),
      embers: embers.map((e) => ({ quote: e.quote, keptAt: e.keptAt, story: { title: e.title, url: link(e.author, e.slug) } })),
      readingLanguages: profile?.readingLanguages ?? null,
      following: {
        writers: followRows.flatMap((f) => (f.user ? [f.user] : [])),
        topics: followRows.flatMap((f) => (f.topic ? [f.topic] : [])),
        circles: followRows.flatMap((f) => (f.circle ? [f.circle] : [])),
      },
      circles: memberships,
      muted: blocks.filter((b) => b.kind === "mute").map((b) => ({ username: b.username, since: b.since })),
      blocked: blocks.filter((b) => b.kind === "block").map((b) => ({ username: b.username, since: b.since })),
    };
  });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fogata-${viewer.username}-data.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
