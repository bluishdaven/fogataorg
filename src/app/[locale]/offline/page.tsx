import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OfflineList } from "@/components/app/offline-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Offline");
  return { title: t("title"), robots: { index: false } };
}

/**
 * What this device keeps for reading offline. Static: the service worker keeps a copy and shows it
 * whenever a page can't load without a connection; the list itself comes from the device.
 */
export default async function OfflinePage() {
  const t = await getTranslations("Offline");
  return (
    <div className="mx-auto max-w-xl px-4 py-12" data-testid="offline-page">
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("lede")}</p>
      <OfflineList />
    </div>
  );
}
