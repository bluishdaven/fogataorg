"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALES, isLocale, pathForLocale } from "@/lib/domain/locale";

/**
 * UI pages switch by changing the /en or /es prefix. Share URLs (/@handle…)
 * have no prefix, so for those we store the choice in the locale cookie and
 * re-render in place.
 */
export function LanguageSwitcher() {
  const t = useTranslations("Language");
  const locale = useLocale();
  // The URL is read on click, not during render, so the header stays prerenderable.
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = (value: string) => {
    if (!isLocale(value) || value === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    const { pathname, search, hash } = window.location;
    startTransition(() => {
      if (pathname.startsWith("/@")) {
        router.refresh();
      } else {
        router.replace(`${pathForLocale(pathname, value)}${search}${hash}`);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-11 sm:min-w-0"
          // Visible text ("EN") must be part of the accessible name (WCAG 2.5.3).
          aria-label={t("current", { language: locale.toUpperCase() })}
          disabled={pending}
          data-testid="language-switcher"
        >
          <Languages className="max-sm:hidden" />
          <span className="font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {t(code)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
