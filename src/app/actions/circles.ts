"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { circleJoinRequests, circleMembers, circles, circleSubmissions, profiles, stories } from "@/lib/db/schema";
import {
  addMemberSchema,
  confirmsCircleName,
  createCircleSchema,
  decisionSchema,
  deleteCircleSchema,
  joinDecisionSchema,
  joinRequestSchema,
  submissionSchema,
  transferCircleSchema,
  updateCircleSchema,
  type CircleErrorKey,
  type CreateCircleInput,
  type UpdateCircleInput,
} from "@/lib/domain/circles";
import { allowAction } from "@/lib/limits";
import { pushSoon } from "@/lib/push/soon";
import { isAllowedStoryImage } from "@/lib/story-images";
import { pgCode } from "@/lib/db/errors";

type Result<T = object> = ({ ok: true } & T) | { ok: false; errors: CircleErrorKey[] };

const FIELD_KEYS = new Set<CircleErrorKey>(["name", "slug", "description", "accent", "headerAlt", "username"]);

function zodErrors(issues: { message: string }[]): CircleErrorKey[] {
  return [...new Set(issues.map((i) => (FIELD_KEYS.has(i.message as CircleErrorKey) ? (i.message as CircleErrorKey) : "invalid")))];
}

function invalidateCircle(slug: string) {
  updateTag("circles");
  updateTag(`circle:${slug.toLowerCase()}`);
}

export async function createCircle(input: CreateCircleInput): Promise<Result<{ slug: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = createCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
  const { name, slug, description, accentColor, header, isPrivate } = parsed.data;
  if (header && !isAllowedStoryImage(header.url)) return { ok: false, errors: ["unsafeImage"] };
  if (!(await allowAction(viewer, "createCircle"))) return { ok: false, errors: ["rateLimited"] };

  try {
    await withRls(viewer.claims, (tx) =>
      tx.insert(circles).values({
        ownerId: viewer.id,
        slug,
        name,
        description,
        accentColor,
        headerUrl: header?.url ?? null,
        headerAlt: header?.alt ?? "",
        headerCredit: header?.credit ?? null,
        isPrivate,
      }),
    );
  } catch (error) {
    if (pgCode(error) === "23505") return { ok: false, errors: ["slugTaken"] };
    throw error;
  }
  invalidateCircle(slug);
  return { ok: true, slug };
}

export async function updateCircle(input: UpdateCircleInput): Promise<Result<{ slug: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = updateCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
  const { circleId, name, description, accentColor, header, isPrivate } = parsed.data;
  if (header && !isAllowedStoryImage(header.url)) return { ok: false, errors: ["unsafeImage"] };

  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .update(circles)
      .set({
        name,
        description,
        accentColor,
        headerUrl: header?.url ?? null,
        headerAlt: header?.alt ?? "",
        headerCredit: header?.credit ?? null,
        isPrivate,
      })
      .where(eq(circles.id, circleId))
      .returning({ slug: circles.slug }),
  );
  if (!row) return { ok: false, errors: ["not_allowed"] };
  invalidateCircle(row.slug);
  return { ok: true, slug: row.slug };
}

async function circleSlug(circleId: string): Promise<string | null> {
  const [row] = await withRls(null, (tx) => tx.select({ slug: circles.slug }).from(circles).where(eq(circles.id, circleId)));
  return row?.slug ?? null;
}

export async function addCircleMember(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
  const { circleId, username, role } = parsed.data;

  try {
    const added = await withRls(viewer.claims, async (tx) => {
      const [person] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(sql`lower(${profiles.username}) = lower(${username})`)
        .limit(1);
      if (!person) return "userNotFound" as const;
      await tx.insert(circleMembers).values({ circleId, userId: person.id, role });
      return "ok" as const;
    });
    if (added !== "ok") return { ok: false, errors: [added] };
  } catch (error) {
    if (pgCode(error) === "23505") return { ok: false, errors: ["alreadyMember"] };
    if (pgCode(error) === "42501") return { ok: false, errors: ["not_allowed"] };
    throw error;
  }
  const slug = await circleSlug(circleId);
  if (slug) invalidateCircle(slug);
  return { ok: true };
}

export async function removeCircleMember(circleId: string, userId: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const rows = await withRls(viewer.claims, (tx) =>
    tx
      .delete(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
      .returning({ id: circleMembers.id }),
  );
  if (!rows.length) return { ok: false, errors: ["not_allowed"] };
  const slug = await circleSlug(circleId);
  if (slug) invalidateCircle(slug);
  return { ok: true };
}

export async function submitToCircle(input: unknown): Promise<Result<{ status: "pending" | "accepted" }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  const { circleId, storyId } = parsed.data;

  let outcome: { status: "pending" | "accepted"; storySlug: string | null };
  try {
    outcome = await withRls(viewer.claims, async (tx) => {
      const [created] = await tx
        .insert(circleSubmissions)
        .values({ circleId, storyId, submittedBy: viewer.id })
        .returning({ id: circleSubmissions.id });
      // Members are auto-accepted by a trigger, so read the status back.
      const [after] = await tx.select({ status: circleSubmissions.status }).from(circleSubmissions).where(eq(circleSubmissions.id, created!.id));
      const [story] = await tx.select({ slug: stories.slug }).from(stories).where(eq(stories.id, storyId));
      return { status: after?.status === "accepted" ? ("accepted" as const) : ("pending" as const), storySlug: story?.slug ?? null };
    });
  } catch (error) {
    if (pgCode(error) === "23505") return { ok: false, errors: ["alreadySubmitted"] };
    if (pgCode(error) === "42501") return { ok: false, errors: ["not_allowed"] };
    throw error;
  }
  if (outcome.status === "accepted") {
    const slug = await circleSlug(circleId);
    if (slug) invalidateCircle(slug);
    if (outcome.storySlug) updateTag(`story:${viewer.username.toLowerCase()}/${outcome.storySlug}`);
  }
  const status = outcome.status;
  pushSoon();
  return { ok: true, status };
}

export async function decideSubmission(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  const { submissionId, status, note } = parsed.data;

  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .update(circleSubmissions)
      .set({ status, declineNote: note })
      .where(eq(circleSubmissions.id, submissionId))
      .returning({ circleId: circleSubmissions.circleId, storyId: circleSubmissions.storyId }),
  );
  if (!row) return { ok: false, errors: ["not_allowed"] };
  await invalidateForSubmission(row.circleId, row.storyId);
  pushSoon();
  return { ok: true };
}

/** Writers withdraw their submission; editors remove a story from the circle. */
export async function removeSubmission(submissionId: string): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .delete(circleSubmissions)
      .where(eq(circleSubmissions.id, submissionId))
      .returning({ circleId: circleSubmissions.circleId, storyId: circleSubmissions.storyId }),
  );
  if (!row) return { ok: false, errors: ["not_allowed"] };
  await invalidateForSubmission(row.circleId, row.storyId);
  return { ok: true };
}

async function invalidateForSubmission(circleId: string, storyId: string) {
  const slug = await circleSlug(circleId);
  if (slug) invalidateCircle(slug);
  const [story] = await withRls(null, (tx) =>
    tx
      .select({ slug: stories.slug, username: profiles.username })
      .from(stories)
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(eq(stories.id, storyId)),
  );
  if (story) updateTag(`story:${story.username.toLowerCase()}/${story.slug}`);
}

/** Ask to join a private circle. */
export async function requestToJoin(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = joinRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  if (!(await allowAction(viewer, "joinRequest"))) return { ok: false, errors: ["rateLimited"] };
  try {
    await withRls(viewer.claims, (tx) => tx.insert(circleJoinRequests).values({ circleId: parsed.data.circleId, userId: viewer.id }));
  } catch (error) {
    if (pgCode(error) === "23505") return { ok: false, errors: ["alreadyRequested"] };
    // Public circle, or already a member.
    if (pgCode(error) === "42501") return { ok: false, errors: ["not_allowed"] };
    throw error;
  }
  pushSoon();
  return { ok: true };
}

/** Take back a request that's still waiting. */
export async function withdrawJoinRequest(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = joinRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  const rows = await withRls(viewer.claims, (tx) =>
    tx
      .delete(circleJoinRequests)
      .where(and(eq(circleJoinRequests.circleId, parsed.data.circleId), eq(circleJoinRequests.userId, viewer.id)))
      .returning({ id: circleJoinRequests.id }),
  );
  return rows.length ? { ok: true } : { ok: false, errors: ["not_allowed"] };
}

/** Owners and editors let someone in (as a writer) or turn them down. */
export async function decideJoinRequest(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = joinDecisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  let slug: string | null;
  try {
    slug = await withRls(viewer.claims, async (tx) => {
      const rows = await tx.execute<{ slug: string | null }>(
        sql`select public.decide_join_request(${parsed.data.requestId}::uuid, ${parsed.data.accept}) as slug`,
      );
      return rows[0]?.slug ?? null;
    });
  } catch (error) {
    if (pgCode(error) === "42501" || pgCode(error) === "55000") return { ok: false, errors: ["not_allowed"] };
    throw error;
  }
  if (slug) invalidateCircle(slug);
  pushSoon();
  return { ok: true };
}

/** The owner hands the circle to another member, staying on as an editor. */
export async function transferCircle(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = transferCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  let slug: string | null;
  try {
    slug = await withRls(viewer.claims, async (tx) => {
      const rows = await tx.execute<{ slug: string | null }>(
        sql`select public.transfer_circle(${parsed.data.circleId}::uuid, ${parsed.data.userId}::uuid) as slug`,
      );
      return rows[0]?.slug ?? null;
    });
  } catch (error) {
    if (pgCode(error) === "42501") return { ok: false, errors: ["not_allowed"] };
    throw error;
  }
  if (slug) invalidateCircle(slug);
  pushSoon();
  return { ok: true };
}

/**
 * The owner deletes the circle for good. Its members, queue and followers go with it; the stories
 * stay with their writers (each story page drops its "Published in" line).
 */
export async function deleteCircle(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = deleteCircleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  const { circleId, confirmName } = parsed.data;

  const outcome = await withRls(viewer.claims, async (tx) => {
    const [circle] = await tx
      .select({ name: circles.name, slug: circles.slug, ownerId: circles.ownerId })
      .from(circles)
      .where(eq(circles.id, circleId));
    if (!circle || circle.ownerId !== viewer.id) return "not_allowed" as const;
    if (!confirmsCircleName(confirmName, circle.name)) return "confirmName" as const;
    // The stories that showed this circle, so their pages can drop it.
    const shown = await tx
      .select({ slug: stories.slug, username: profiles.username })
      .from(circleSubmissions)
      .innerJoin(stories, eq(stories.id, circleSubmissions.storyId))
      .innerJoin(profiles, eq(profiles.id, stories.authorId))
      .where(and(eq(circleSubmissions.circleId, circleId), eq(circleSubmissions.status, "accepted")));
    const deleted = await tx.delete(circles).where(eq(circles.id, circleId)).returning({ id: circles.id });
    return deleted.length ? { slug: circle.slug, shown } : ("not_allowed" as const);
  });
  if (typeof outcome === "string") return { ok: false, errors: [outcome] };
  invalidateCircle(outcome.slug);
  for (const story of outcome.shown) updateTag(`story:${story.username.toLowerCase()}/${story.slug}`);
  return { ok: true };
}
