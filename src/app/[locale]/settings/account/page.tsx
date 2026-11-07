import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsNav } from "@/components/settings-nav";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { listBlocked } from "@/lib/data/blocks";
import { BlockedPeople } from "./blocked-people";
import { DeleteAccountForm } from "./delete-account-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account");
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountSettingsPage() {
  const t = await getTranslations("Account");
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <SettingsNav active="account" />
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("lede")}</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <Sections />
      </Suspense>
    </div>
  );
}

async function Sections() {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings/account`)}`);
  const [t, blocked] = await Promise.all([getTranslations("Account"), listBlocked(viewer)]);
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="feed-heading" className="flex flex-col gap-3">
        <h2 id="feed-heading" className="font-serif text-2xl font-semibold">
          {t("feedTitle")}
        </h2>
        <p className="text-sm text-pretty">{t("feedBody")}</p>
        <div>
          <Link
            href={{ pathname: "/welcome", query: { next: `/${locale}/settings/account` } }}
            className={buttonVariants({ variant: "outline" })}
            data-testid="change-feeds"
          >
            {t("feedButton")}
          </Link>
        </div>
      </section>
      <section aria-labelledby="blocked-heading" className="flex flex-col gap-3">
        <h2 id="blocked-heading" className="font-serif text-2xl font-semibold">
          {t("blockedTitle")}
        </h2>
        <p className="text-sm text-pretty">{t("blockedBody")}</p>
        <BlockedPeople people={blocked} />
      </section>
      <section aria-labelledby="export-heading" className="flex flex-col gap-3">
        <h2 id="export-heading" className="font-serif text-2xl font-semibold">
          {t("exportTitle")}
        </h2>
        <p className="text-sm text-pretty">{t("exportBody")}</p>
        <div>
          {/* A plain link: the route answers with the file as a download. */}
          <a href="/api/me/export" download className={buttonVariants({ variant: "outline" })} data-testid="export-data">
            {t("exportButton")}
          </a>
        </div>
      </section>
      <section aria-labelledby="delete-heading" className="flex flex-col gap-3 rounded-2xl border border-destructive/40 p-5">
        <h2 id="delete-heading" className="font-serif text-2xl font-semibold">
          {t("deleteTitle")}
        </h2>
        <p className="text-sm text-pretty">{t("deleteBody")}</p>
        <DeleteAccountForm username={viewer.username} />
      </section>
    </div>
  );
}
