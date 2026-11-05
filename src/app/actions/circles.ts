"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { circleMembers, circles, circleSubmissions, profiles, stories } from "@/lib/db/schema";
import {
  addMemberSchema,
  createCircleSchema,
  decisionSchema,
  submissionSchema,
  updateCircleSchema,
  type CircleErrorKey,
  type CreateCircleInput,
  type UpdateCircleInput,
} from "@/lib/domain/circles";
import { isAllowedStoryImage } from "@/lib/story-images";

type Result<T = object> = ({ ok: true } & T) | { ok: false; errors: CircleErrorKey[] };

const FIELD_KEYS = new Set<CircleErrorKey>(["name", "slug", "description", "accent", "headerAlt", "username"]);

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

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
  const { name, slug, description, accentColor, header } = parsed.data;
  if (header && !isAllowedStoryImage(header.url)) return { ok: false, errors: ["unsafeImage"] };

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
  const { circleId, name, description, accentColor, header } = parsed.data;
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
  return { ok: true, status };
}

export async function decideSubmission(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, errors: ["unauthorized"] };
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: ["invalid"] };
  const { submissionId, status } = parsed.data;

  const [row] = await withRls(viewer.claims, (tx) =>
    tx
      .update(circleSubmissions)
      .set({ status })
      .where(eq(circleSubmissions.id, submissionId))
      .returning({ circleId: circleSubmissions.circleId, storyId: circleSubmissions.storyId }),
  );
  if (!row) return { ok: false, errors: ["not_allowed"] };
  await invalidateForSubmission(row.circleId, row.storyId);
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
