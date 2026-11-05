import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ModerationPanel } from "@/components/moderation/moderation-panel";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { moderationLog, profiles, stories, storyModeration } from "@/lib/db/schema";
import { storyPath } from "@/lib/domain/handle-routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Moderation");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function ModerationPage() {
  const t = await getTranslations("Moderation");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold">{t("pageTitle")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("pageLede")}</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden />}>
        <Moderated />
      </Suspense>
    </div>
  );
}

const author = alias(profiles, "author");
const moderator = alias(profiles, "moderator");

async function Moderated() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/moderation`)}`);
  if (!viewer.isAdmin) notFound();

  const [current, log, t, format] = await Promise.all([
    withRls(viewer.claims, (tx) =>
      tx
        .select({
          storyId: storyModeration.storyId,
          status: storyModeration.status,
          reason: storyModeration.reason,
          moderatedAt: storyModeration.moderatedAt,
          title: stories.title,
          slug: stories.slug,
          authorUsername: author.username,
          moderatorName: moderator.displayName,
          moderatorUsername: moderator.username,
        })
        .from(storyModeration)
        .innerJoin(stories, eq(stories.id, storyModeration.storyId))
        .innerJoin(author, eq(author.id, stories.authorId))
        .leftJoin(moderator, eq(moderator.id, storyModeration.moderatedBy))
        .orderBy(desc(storyModeration.moderatedAt))
        .limit(200),
    ),
    withRls(viewer.claims, (tx) =>
      tx
        .select({
          id: moderationLog.id,
          status: moderationLog.status,
          reason: moderationLog.reason,
          createdAt: moderationLog.createdAt,
          title: stories.title,
          moderatorName: moderator.displayName,
          moderatorUsername: moderator.username,
        })
        .from(moderationLog)
        .innerJoin(stories, eq(stories.id, moderationLog.storyId))
        .leftJoin(moderator, eq(moderator.id, moderationLog.moderatorId))
        .orderBy(desc(moderationLog.createdAt))
        .limit(50),
    ),
    getTranslations("Moderation"),
    getFormatter(),
  ]);

  return (
    <>
      {current.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4" data-testid="moderated-stories">
          {current.map((row) => (
            <li key={row.storyId} className="flex flex-col gap-2" data-testid="moderated-story">
              <p>
                <NextLink href={storyPath(row.authorUsername, row.slug)} className="font-serif text-lg font-semibold hover:text-ember-text">
                  {row.title}
                </NextLink>{" "}
                <span className="text-sm text-muted-foreground">@{row.authorUsername}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {row.status === "nsfw" ? t("statusNsfw") : t("statusRemoved")} ·{" "}
                {t("byOn", {
                  name: row.moderatorName || row.moderatorUsername || "—",
                  date: format.dateTime(row.moderatedAt, { dateStyle: "medium" }),
                })}
              </p>
              <ModerationPanel storyId={row.storyId} status={row.status} reason={row.reason} />
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="log-heading" className="mt-12">
        <h2 id="log-heading" className="mb-3 font-serif text-2xl font-semibold">
          {t("logTitle")}
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border text-sm" data-testid="moderation-log">
          {log.map((row) => (
            <li key={row.id} className="p-4">
              <p className="font-medium">{row.title}</p>
              <p className="text-muted-foreground">
                {row.status === "nsfw" ? t("statusNsfw") : row.status === "removed" ? t("statusRemoved") : t("statusLifted")}
                {row.reason ? ` · ${row.reason}` : ""} ·{" "}
                {t("byOn", {
                  name: row.moderatorName || row.moderatorUsername || "—",
                  date: format.dateTime(row.createdAt, { dateStyle: "medium", timeStyle: "short" }),
                })}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
