import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsNav } from "@/components/settings-nav";
import { getViewer } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { EmailFrequencyForm } from "./email-frequency-form";
import { PushSettings } from "./push-settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EmailSettings");
  return { title: t("title"), robots: { index: false } };
}

export default async function NotificationSettingsPage() {
  const [t, push] = await Promise.all([getTranslations("EmailSettings"), getTranslations("PushSettings")]);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <SettingsNav active="notifications" />
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      {/* Push needs keys on the server; without them there's nothing to switch on. */}
      {publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
        <section className="mt-8" aria-labelledby="push-title">
          <h2 id="push-title" className="font-serif text-2xl font-semibold">
            {push("title")}
          </h2>
          <p className="mt-2 mb-4 text-muted-foreground">{push("lede")}</p>
          <PushSettings />
        </section>
      ) : null}
      <section className="mt-10" aria-labelledby="email-title">
        <h2 id="email-title" className="font-serif text-2xl font-semibold">
          {t("emailTitle")}
        </h2>
        <p className="mt-2 mb-6 text-muted-foreground">{t("lede")}</p>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" aria-hidden />}>
          <Form />
        </Suspense>
      </section>
    </div>
  );
}

async function Form() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings/notifications`)}`);
  const [profile] = await withRls(viewer.claims, (tx) =>
    tx
      .select({ frequency: profiles.emailFrequency, weekday: profiles.emailWeekday })
      .from(profiles).where(eq(profiles.id, viewer.id)).limit(1),
  );
  if (!profile) redirect(`/${locale}`);
  return <EmailFrequencyForm initial={profile.frequency} weekday={profile.weekday} />;
}
