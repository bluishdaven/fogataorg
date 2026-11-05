import { useTranslations } from "next-intl";
import { FlameLogo } from "@/components/flame-logo";
import { Link } from "@/i18n/navigation";
import { isPublicSite } from "@/lib/deployment";
import { SUPPORT_URL } from "@/lib/domain/links";

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
            <p>
              {t.rich("Footer.support", {
                link: (chunks) => (
                  <a
                    href={SUPPORT_URL}
                    rel="noopener"
                    className="font-medium text-ember-text underline underline-offset-2 hover:text-foreground"
                    data-testid="support-link"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-0 sm:gap-y-2" aria-label={t("Nav.footer")}>
          <Link href="/topics" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline sm:min-h-0">
            {t("Nav.topics")}
          </Link>
          {/* Placeholder until the shop opens: disabled, so it can't be activated and reads as unavailable. */}
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 text-muted-foreground/60 sm:min-h-0"
            data-testid="merch-soon"
          >
            {t("Nav.merch")}
            <span className="rounded-full border border-border px-1.5 py-px text-[0.65rem] font-medium tracking-wide uppercase">
              {t("Nav.comingSoon")}
            </span>
          </button>
          <Link href="/circles" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline sm:min-h-0">
            {t("Nav.circles")}
          </Link>
          {isPublicSite ? null : (
            <Link href="/design" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline sm:min-h-0">
              {t("Nav.design")}
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
