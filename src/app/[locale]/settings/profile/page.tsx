import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsNav } from "@/components/settings-nav";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
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
      .select({ username: profiles.username, displayName: profiles.displayName, bio: profiles.bio, links: profiles.links })
      .from(profiles)
      .where(eq(profiles.id, viewer.id))
      .limit(1),
  );
  if (!profile) redirect(`/${locale}`);
  return <ProfileForm initial={profile} />;
}
