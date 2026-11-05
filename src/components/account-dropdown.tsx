"use client";

import { BookOpenText, LogOut, Settings, UserRound } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { profilePath } from "@/lib/domain/handle-routes";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function AccountDropdown({
  displayName,
  username,
  locale,
}: {
  displayName: string;
  username: string;
  locale: string;
}) {
  const t = useTranslations();
  const letters = initials(displayName);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 rounded-full bg-ember-soft font-semibold text-ember-text"
          // Visible initials must be part of the accessible name (WCAG 2.5.3).
          aria-label={`${t("Nav.account")}: ${letters}`}
          data-testid="account-menu"
        >
          <span aria-hidden className="text-xs">
            {letters}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{displayName}</span>
          <span className="block text-xs text-muted-foreground">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <NextLink href={profilePath(username)}>
            <UserRound />
            {t("Nav.profile")}
          </NextLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/stories">
            <BookOpenText />
            {t("Nav.myStories")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings />
            {t("Nav.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOut} className="w-full">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="flex w-full items-center gap-2" data-testid="sign-out">
              <LogOut className="size-4 text-muted-foreground" />
              {t("Nav.signOut")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
