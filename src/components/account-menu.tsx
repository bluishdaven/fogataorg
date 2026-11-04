import { getLocale, getTranslations } from "next-intl/server";
import { AccountDropdown } from "@/components/account-dropdown";
import { buttonVariants } from "@/components/ui/button";
import { WriteButton } from "@/components/write-button";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/auth";
import { cn } from "@/lib/utils";

export async function AccountMenu() {
  const [viewer, t, locale] = await Promise.all([getViewer(), getTranslations("Nav"), getLocale()]);

  if (!viewer) {
    return (
      <Link href="/login" className={cn(buttonVariants({ size: "default" }), "ml-1")} data-testid="sign-in-link">
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <WriteButton />
      <AccountDropdown displayName={viewer.displayName} username={viewer.username} locale={locale} />
    </div>
  );
}
