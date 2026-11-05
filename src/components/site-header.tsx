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
    <header className="group/header sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:h-14 sm:gap-4">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center gap-2 rounded-md font-serif text-xl font-semibold tracking-tight"
          aria-label={`Fogata — ${t("home")}`}
        >
          <FlameLogo className="h-7" />
          {/* On phones the signed-in controls need the room; the flame still links home. */}
          <span className="max-sm:group-has-[[data-testid=account-menu]]/header:sr-only">Fogata</span>
        </Link>
        <nav aria-label={t("primary")} className="flex items-center gap-0.5 sm:gap-1">
          <SearchButton />
          <LanguageSwitcher />
          <ThemeSwitcher />
          {/* The session is request data; it streams in so the rest of the page stays static. */}
          <Suspense fallback={<div className="ml-1 h-11 w-24 animate-pulse rounded-full bg-muted sm:h-9" aria-hidden />}>
            <AccountMenu />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
