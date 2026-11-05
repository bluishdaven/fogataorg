"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getUnreadNotificationCount } from "@/app/actions/social";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Header bell with the unread count. Updates live through Supabase Realtime
 * (RLS limits the subscription to the reader's own notifications).
 */
export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const t = useTranslations("Social");
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const refresh = async () => {
      const next = await getUnreadNotificationCount();
      if (active) setCount(next);
    };
    // The Supabase client is ~70 KB of JS that no page needs to render; load it after hydration.
    void import("@/lib/supabase/client").then(({ supabaseBrowser }) => {
      if (!active) return;
      const supabase = supabaseBrowser();
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
          void refresh();
        })
        .subscribe();
      unsubscribe = () => void supabase.removeChannel(channel);
    });
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      unsubscribe();
    };
  }, [userId]);

  return (
    <Link
      href="/me/notifications"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
      aria-label={count ? t("notificationsUnread", { count }) : t("notifications")}
      data-testid="notification-bell"
    >
      <Bell aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-semibold text-primary-foreground"
          data-testid="notification-count"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
