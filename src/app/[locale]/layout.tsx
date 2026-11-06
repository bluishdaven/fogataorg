import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Inter, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { locale as rootLocale } from "next/root-params";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import { HEADLINE_SCRIPT } from "@/lib/domain/headlines";
import { OG_SIZE, ogPaths } from "@/lib/domain/og";
import { READER_PREFS_SCRIPT } from "@/lib/domain/reader-prefs";
import { publicEnv } from "@/lib/env";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await rootLocale();
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : "en", namespace: "Metadata" });
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    applicationName: "Fogata",
    openGraph: {
      siteName: "Fogata",
      type: "website",
      locale: locale === "es" ? "es_MX" : "en_US",
      // Pages without their own preview (home, topics, circles…) share the flame card.
      images: [{ url: ogPaths.site(locale === "es" ? "es" : "en"), ...OG_SIZE, alt: "Fogata" }],
    },
    twitter: { card: "summary_large_image" },
    // Same text-and-data-mining opt-out as the response headers, for crawlers that read the page.
    other: { "tdm-reservation": "1" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html lang={locale} className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        {/* Applies saved reader preferences before paint (no layout jump). */}
        <Script id="reader-prefs" strategy="beforeInteractive">
          {READER_PREFS_SCRIPT}
        </Script>
        {/* Picks this visit's home headline before paint (see HomeHeadline). */}
        <Script id="headline" strategy="beforeInteractive">
          {HEADLINE_SCRIPT}
        </Script>
        <ThemeProvider>
          <NextIntlClientProvider>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
