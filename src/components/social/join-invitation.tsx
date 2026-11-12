import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { EmberDrift } from "@/components/ember-drift";
import { FlameLogo } from "@/components/flame-logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * For readers who aren't signed in, after the writer's card: what Fogata is and a way in that brings
 * them back to this story. Shared links land people here, so this is where most of them meet Fogata.
 */
export async function JoinInvitation({ authorName, loginHref }: { authorName: string; loginHref: string }) {
  const t = await getTranslations("Join");
  return (
    <section
      aria-labelledby="join-title"
      className="relative mx-auto mt-8 max-w-[var(--measure)] overflow-hidden rounded-2xl border border-ember/40 bg-card p-6 sm:p-8"
      data-testid="join-invitation"
    >
      <EmberDrift className="right-0 left-auto w-28 sm:w-40" count={6} rise="-120px" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <FlameLogo className="h-12 shrink-0 self-start" />
        <div className="flex flex-col gap-3">
          <h2 id="join-title" className="font-serif text-2xl font-semibold text-balance">
            {t("title")}
          </h2>
          <p className="max-w-prose text-pretty">{t("body", { name: authorName })}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            <NextLink href={loginHref} className={buttonVariants()} data-testid="join-cta">
              {t("join")}
            </NextLink>
            <Link href="/manifesto" className="text-sm font-medium text-ember-text underline underline-offset-4">
              {t("why")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
