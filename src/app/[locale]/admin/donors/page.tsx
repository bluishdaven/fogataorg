import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import NextLink from "next/link";
import { Suspense } from "react";
import { DonorIcon } from "@/components/badges/badge-icons";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { donorActiveSql } from "@/lib/data/badge-sql";
import { donorGrants, profiles } from "@/lib/db/schema";
import { profilePath } from "@/lib/domain/handle-routes";
import { GrantDonorForm, RemoveDonorButton } from "./donor-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("donorsTitle"), robots: { index: false } };
}

export default async function DonorsPage() {
  const t = await getTranslations("Admin");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="flex items-center gap-3 font-serif text-4xl font-semibold">
        <DonorIcon className="h-9 w-auto" />
        {t("donorsTitle")}
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("donorsLede")}</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" aria-hidden />}>
        <Donors />
      </Suspense>
    </div>
  );
}

async function Donors() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/donors`)}`);
  // Everyone but the owner gets the same answer as a page that doesn't exist.
  if (!viewer.isAdmin) notFound();

  const [rows, t, format] = await Promise.all([
    withRls(viewer.claims, (tx) =>
      tx
        .select({
          id: donorGrants.id,
          userId: donorGrants.userId,
          note: donorGrants.note,
          grantedAt: donorGrants.grantedAt,
          endsAt: donorGrants.endsAt,
          removedAt: donorGrants.removedAt,
          username: profiles.username,
          displayName: profiles.displayName,
          donorUntil: profiles.donorUntil,
          donorActive: donorActiveSql(),
        })
        .from(donorGrants)
        .innerJoin(profiles, eq(profiles.id, donorGrants.userId))
        .orderBy(desc(donorGrants.grantedAt))
        .limit(300),
    ),
    getTranslations("Admin"),
    getFormatter(),
  ]);

  return (
    <>
      <GrantDonorForm />
      <section aria-labelledby="grants-heading" className="mt-12">
        <h2 id="grants-heading" className="mb-3 font-serif text-2xl font-semibold">
          {t("grants")}
        </h2>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border" data-testid="donor-grants">
            {rows.map((row) => {
              const name = row.displayName || row.username;
              const active = !row.removedAt && row.donorActive;
              return (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-4" data-testid="donor-grant">
                  <div className="min-w-0">
                    <NextLink href={profilePath(row.username)} className="font-medium hover:text-ember-text">
                      {name}
                    </NextLink>{" "}
                    <span className="text-sm text-muted-foreground">@{row.username}</span>
                    <p className="text-sm text-muted-foreground">
                      {t("grantedOn", { date: format.dateTime(row.grantedAt, { dateStyle: "medium" }) })}
                      {row.removedAt
                        ? ` · ${t("removedOn", { date: format.dateTime(row.removedAt, { dateStyle: "medium" }) })}`
                        : active && row.donorUntil
                          ? ` · ${t("activeUntil", { date: format.dateTime(row.donorUntil, { dateStyle: "medium" }) })}`
                          : row.endsAt
                            ? ` · ${t("endedOn", { date: format.dateTime(row.endsAt, { dateStyle: "medium" }) })}`
                            : null}
                    </p>
                    {row.note ? <p className="mt-1 text-sm text-pretty">{row.note}</p> : null}
                  </div>
                  {active ? <RemoveDonorButton userId={row.userId} name={name} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
