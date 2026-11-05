"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Header search link. Pressing "/" anywhere outside a text field opens search. */
export function SearchButton() {
  const t = useTranslations("Search");
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      router.push(`/${locale}/search`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locale, router]);

  return (
    <Link
      href="/search"
      className={buttonVariants({ variant: "ghost", size: "icon" })}
      aria-label={t("open")}
      aria-keyshortcuts="/"
      title={t("openWithShortcut")}
      data-testid="search-button"
    >
      <Search aria-hidden />
    </Link>
  );
}
