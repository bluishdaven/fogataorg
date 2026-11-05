import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "profile", href: "/settings/profile", label: "profileTab" },
  { key: "notifications", href: "/settings/notifications", label: "notificationsTab" },
] as const;

/** Tabs across the settings pages. Each page passes its own key (no pathname reads, so pages stay prerenderable). */
export async function SettingsNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  const t = await getTranslations("EmailSettings");
  return (
    <nav aria-label={t("nav")} className="mb-8 flex gap-1 border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            tab.key === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t(tab.label)}
        </Link>
      ))}
    </nav>
  );
}
