import { useTranslations } from "next-intl";
import { FlameLogo } from "@/components/flame-logo";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-md gap-3">
          <FlameLogo className="h-6 shrink-0" animated={false} />
          <div className="space-y-1">
            <p className="text-foreground">{t("Footer.tagline")}</p>
            <p>{t("Footer.rights")}</p>
            <p>{t("Footer.support")}</p>
          </div>
        </div>
        <nav className="flex gap-4" aria-label={t("Nav.footer")}>
          <Link href="/topics" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("Nav.topics")}
          </Link>
          <Link href="/design" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("Nav.design")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
