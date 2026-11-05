"use client";

import { Bell, Bookmark, BookOpenText, LogOut, Settings, UserRound } from "lucide-react";
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
import { Avatar } from "@/components/avatar";
import { initials } from "@/lib/domain/avatars";
import { profilePath } from "@/lib/domain/handle-routes";

export function AccountDropdown({
  displayName,
  username,
  avatarUrl,
  locale,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
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
          className="ml-1 p-0"
          // Visible initials must be part of the accessible name (WCAG 2.5.3).
          aria-label={`${t("Nav.account")}: ${letters}`}
          data-testid="account-menu"
        >
          <Avatar name={displayName} url={avatarUrl} className="size-9 text-xs sm:size-8" />
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
          <Link href="/me/saved">
            <Bookmark />
            {t("Nav.saved")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/notifications">
            <Bell />
            {t("Nav.notifications")}
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
