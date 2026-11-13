import { BellRing, Smartphone, WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { InstallPanel } from "@/components/app/install-panel";
import { FlameLogo } from "@/components/flame-logo";
import { localeAlternates } from "@/lib/domain/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("App"), getLocale()]);
  return { title: t("title"), description: t("description"), alternates: localeAlternates(locale, "/app") };
}

const BENEFITS = [
  { key: "home", Icon: Smartphone },
  { key: "offline", Icon: WifiOff },
  { key: "notify", Icon: BellRing },
] as const;

/** "Fogata on your phone": what installing gives you and how, for whichever browser this is. */
export default async function AppPage() {
  const t = await getTranslations("App");
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16" data-testid="app-page">
      <header className="flex flex-col gap-5">
        <FlameLogo className="h-10 w-auto self-start" />
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance sm:text-5xl">{t("title")}</h1>
        <p className="font-serif text-xl leading-relaxed text-pretty text-muted-foreground">{t("lede")}</p>
      </header>
      <ul className="mt-10 grid gap-6 sm:grid-cols-3">
        {BENEFITS.map(({ key, Icon }) => (
          <li key={key} className="flex flex-col gap-2">
            <Icon aria-hidden className="size-6 text-ember-text" />
            <h2 className="font-semibold">{t(`benefits.${key}.title`)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(`benefits.${key}.body`)}</p>
          </li>
        ))}
      </ul>
      <section className="mt-12 rounded-2xl border border-border bg-card p-6" aria-labelledby="install-title">
        <h2 id="install-title" className="font-serif text-2xl font-semibold">
          {t("installTitle")}
        </h2>
        <InstallPanel />
        <p className="mt-6 text-sm text-muted-foreground">{t("free")}</p>
      </section>
    </div>
  );
}
