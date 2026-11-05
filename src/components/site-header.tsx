import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { FlameLogo } from "@/components/flame-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchButton } from "@/components/search-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Link } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useTranslations("Nav");
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-serif text-xl font-semibold tracking-tight"
          aria-label={`Fogata — ${t("home")}`}
        >
          <FlameLogo className="h-7" />
          <span>Fogata</span>
        </Link>
        <nav aria-label={t("primary")} className="flex items-center gap-1">
          <SearchButton />
          <LanguageSwitcher />
          <ThemeSwitcher />
          {/* The session is request data; it streams in so the rest of the page stays static. */}
          <Suspense fallback={<div className="ml-1 h-8 w-20 animate-pulse rounded-lg bg-muted" aria-hidden />}>
            <AccountMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
