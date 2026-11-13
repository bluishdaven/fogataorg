"use client";

import { Bell, BookOpenText, Bookmark, ChartNoAxesColumn, Coffee, Flame, HandHeart, Settings, ShieldAlert, Smartphone, UserRound, UsersRound } from "lucide-react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useInstallState } from "@/components/app/app-shell";
import { SignOutForm } from "@/components/app/sign-out-form";
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
import { UserBadges } from "@/components/badges/user-badges";
import { initials } from "@/lib/domain/avatars";
import type { BadgeData } from "@/lib/domain/badges";
import { profilePath } from "@/lib/domain/handle-routes";
import { SUPPORT_URL } from "@/lib/domain/links";

export function AccountDropdown({
  displayName,
  username,
  avatarUrl,
  badges,
  isAdmin,
  locale,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  badges: BadgeData;
  isAdmin: boolean;
  locale: string;
}) {
  const t = useTranslations();
  const letters = initials(displayName);
  // Already running installed: nothing to offer.
  const installState = useInstallState();
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
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {displayName}
            <UserBadges badges={badges} />
          </span>
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
          <Link href="/me/stats" data-testid="stats-link">
            <ChartNoAxesColumn />
            {t("Nav.stats")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/saved">
            <Bookmark />
            {t("Nav.saved")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/embers" data-testid="embers-link">
            <Flame />
            {t("Nav.embers")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/circles" data-testid="circles-link">
            <UsersRound />
            {t("Nav.circles")}
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
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/donors" data-testid="admin-donors-link">
              <HandHeart />
              {t("Nav.donors")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/moderation" data-testid="admin-moderation-link">
              <ShieldAlert />
              {t("Nav.moderation")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/prompts" data-testid="admin-prompts-link">
              <Flame />
              {t("Admin.promptsLink")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {installState !== "installed" ? (
          <DropdownMenuItem asChild>
            <Link href="/app" data-testid="menu-app-link">
              <Smartphone />
              {t("App.footerLink")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {/* Donations keep Fogata free (there is no paid tier). */}
        <DropdownMenuItem asChild>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" data-testid="donate-link">
            <Coffee />
            {t("Nav.donate")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <SignOutForm locale={locale}>{t("Nav.signOut")}</SignOutForm>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
