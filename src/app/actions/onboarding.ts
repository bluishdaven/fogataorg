"use server";

import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { follows, profiles, topics } from "@/lib/db/schema";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale, type Locale } from "@/lib/domain/locale";
import { languagesSchema, topicsSchema } from "@/lib/domain/onboarding";
import { safeNextPath } from "@/lib/domain/redirect";

export type OnboardingState = { error: "readingLanguages" | "tooFewTopics" | "invalid" | null };

function stepUrl(locale: Locale, step: "topics" | "writers", next: string | null) {
  const query = new URLSearchParams({ step });
  if (next) query.set("next", next);
  return `/${locale}/welcome?${query}`;
}

function nextOf(formData: FormData): string | null {
  const value = formData.get("next");
  return typeof value === "string" && value ? safeNextPath(value, "") || null : null;
}

async function requireViewer(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) {
    const locale = String(formData.get("locale") ?? "en");
    redirect(`/${isLocale(locale) ? locale : "en"}/login?next=${encodeURIComponent(`/${isLocale(locale) ? locale : "en"}/welcome`)}`);
  }
  return viewer;
}

/** Step one: the UI language and the languages they read. */
export async function saveLanguages(_state: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const viewer = await requireViewer(formData);
  const parsed = languagesSchema.safeParse({
    locale: formData.get("locale"),
    readingLanguages: formData.getAll("readingLanguages"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((issue) => issue.message === "readingLanguages") ? "readingLanguages" : "invalid" };
  }
  const { locale, readingLanguages } = parsed.data;
  await withRls(viewer.claims, (tx) =>
    tx.update(profiles).set({ locale, readingLanguages }).where(eq(profiles.id, viewer.id)),
  );
  // Share URLs (/@handle…) follow this cookie.
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  redirect(stepUrl(locale, "topics", nextOf(formData)));
}

/** Step two: at least three topics, followed (and topics they unticked, unfollowed). */
export async function saveTopics(_state: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const viewer = await requireViewer(formData);
  const parsed = topicsSchema.safeParse({ topics: formData.getAll("topics") });
  if (!parsed.success) {
    return { error: parsed.error.issues.some((issue) => issue.message === "tooFewTopics") ? "tooFewTopics" : "invalid" };
  }
  await withRls(viewer.claims, async (tx) => {
    const chosen = await tx.select({ id: topics.id }).from(topics).where(inArray(topics.slug, parsed.data.topics));
    const ids = chosen.map((row) => row.id);
    if (ids.length > 0) {
      await tx
        .insert(follows)
        .values(ids.map((followedTopicId) => ({ followerId: viewer.id, followedTopicId })))
        .onConflictDoNothing();
    }
    await tx
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, viewer.id),
          isNotNull(follows.followedTopicId),
          ids.length > 0 ? notInArray(follows.followedTopicId, ids) : undefined,
        ),
      );
  });
  const locale = String(formData.get("locale") ?? "en");
  redirect(stepUrl(isLocale(locale) ? locale : "en", "writers", nextOf(formData)));
}

/** Done or "Skip for now": either way, onboarding is over and they go where they were headed. */
export async function finishOnboarding(formData: FormData): Promise<void> {
  const viewer = await requireViewer(formData);
  await withRls(viewer.claims, (tx) =>
    tx.update(profiles).set({ onboardedAt: new Date() }).where(eq(profiles.id, viewer.id)),
  );
  const locale = String(formData.get("locale") ?? "en");
  redirect(nextOf(formData) ?? `/${isLocale(locale) ? locale : "en"}`);
}
