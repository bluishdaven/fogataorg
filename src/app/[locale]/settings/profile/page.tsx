import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DonorIcon } from "@/components/badges/badge-icons";
import { SettingsNav } from "@/components/settings-nav";
import { donorActiveSql } from "@/lib/data/badge-sql";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { AvatarEditor } from "./avatar-editor";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("title"), robots: { index: false } };
}

export default async function ProfileSettingsPage() {
  const t = await getTranslations("Settings");
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <SettingsNav active="profile" />
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("lede")}</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings/profile`)}`);
  const [profile] = await withRls(viewer.claims, (tx) =>
    tx
      .select({
        username: profiles.username,
        displayName: profiles.displayName,
        bio: profiles.bio,
        links: profiles.links,
        avatarUrl: profiles.avatarUrl,
        donorUntil: profiles.donorUntil,
        donorActive: donorActiveSql(),
      })
      .from(profiles)
      .where(eq(profiles.id, viewer.id))
      .limit(1),
  );
  if (!profile) redirect(`/${locale}`);
  const [format, t] = await Promise.all([getFormatter(), getTranslations("Settings")]);
  return (
    <>
      {profile.donorActive && profile.donorUntil ? (
        <p className="mb-8 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm" data-testid="donor-until">
          <DonorIcon className="size-5 shrink-0" />
          {t("donorUntil", { date: format.dateTime(profile.donorUntil, { dateStyle: "long" }) })}
        </p>
      ) : null}
      <AvatarEditor userId={viewer.id} name={profile.displayName || profile.username} initialUrl={profile.avatarUrl} />
      <ProfileForm initial={profile} />
    </>
  );
}
