"use client";

import { Check, Coffee } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nextWritingTier, WRITING_TIERS, writingTier, type BadgeData, type WritingTierKey } from "@/lib/domain/badges";
import { SUPPORT_URL } from "@/lib/domain/links";
import { cn } from "@/lib/utils";
import { DonorIcon, TierIcon } from "./badge-icons";

type Shown = WritingTierKey | "donor";

const CHIP =
  "relative inline-flex min-h-8 items-center gap-2 rounded-full border border-border px-3 text-sm hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 sm:after:hidden";

/**
 * A person's badges on their profile, as chips. Tapping one explains it and shows every badge
 * there is, with the ones this person has earned marked.
 */
export function BadgeChips({ badges, name, className }: { badges: BadgeData; name: string; className?: string }) {
  const t = useTranslations("Badges");
  const [shown, setShown] = useState<Shown | null>(null);
  const tier = writingTier(badges.stories);
  if (!tier && !badges.donor) return null;

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)} data-testid="user-badges">
        {badges.donor ? (
          <li data-badge="donor">
            <button type="button" className={CHIP} onClick={() => setShown("donor")} data-testid="badge-chip">
              <DonorIcon className="h-4 w-auto" />
              <span>{t("donor")}</span>
              <span className="sr-only">: {t("donorLabel", { name: t("donor") })}</span>
            </button>
          </li>
        ) : null}
        {tier ? (
          <li data-badge={tier.key}>
            <button type="button" className={CHIP} onClick={() => setShown(tier.key)} data-testid="badge-chip">
              <TierIcon tier={tier.key} className="h-4 w-auto" />
              <span>{t(`tiers.${tier.key}`)}</span>
              <span className="sr-only">: {t("tierLabel", { name: t(`tiers.${tier.key}`), count: tier.min })}</span>
            </button>
          </li>
        ) : null}
      </ul>
      <Dialog open={shown !== null} onOpenChange={(open) => !open && setShown(null)}>
        <DialogContent closeLabel={t("close")} className="max-h-[85dvh] overflow-y-auto sm:max-w-md" data-testid="badge-guide">
          {shown ? <BadgeGuide shown={shown} badges={badges} name={name} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BadgeGuide({ shown, badges, name }: { shown: Shown; badges: BadgeData; name: string }) {
  const t = useTranslations("Badges");
  const current = writingTier(badges.stories);
  const next = nextWritingTier(badges.stories);
  const shownTier = shown === "donor" ? null : WRITING_TIERS.find((tier) => tier.key === shown);

  return (
    <>
      <DialogHeader className="items-center pt-2 text-center">
        {shownTier ? <TierIcon tier={shownTier.key} className="h-14 w-auto" /> : <DonorIcon className="h-14 w-auto" />}
        <DialogTitle className="font-serif text-2xl font-semibold">
          {shownTier ? t(`tiers.${shownTier.key}`) : t("donor")}
        </DialogTitle>
        <DialogDescription className="text-pretty">
          {shownTier ? t("tierMeaning", { count: shownTier.min }) : t("donorMeaning")}
        </DialogDescription>
      </DialogHeader>

      <section aria-labelledby="donor-badge" className="flex flex-col gap-3">
        <h3 id="donor-badge" className="font-semibold">
          {t("donorHeading")}
        </h3>
        <div
          className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", badges.donor && "bg-ember-soft")}
          data-tier="donor"
          data-earned={badges.donor}
        >
          <span className="flex w-8 shrink-0 justify-center">
            <DonorIcon className={cn("h-6 w-auto", !badges.donor && "opacity-40 grayscale")} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{t("donor")}</span>
            <span className="block text-xs text-muted-foreground">{t("donorInfo")}</span>
          </span>
          {badges.donor ? (
            <span className="flex items-center gap-1 text-xs font-medium text-ember-text">
              <Check className="size-4" aria-hidden />
              {t("earned")}
            </span>
          ) : null}
        </div>
        {/* Offered to everyone, whether or not this person has the badge. */}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants(), "w-full")}
          data-testid="support-fogata"
        >
          <Coffee />
          {t("support")}
        </a>
      </section>

      <section aria-labelledby="writing-badges" className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 id="writing-badges" className="font-semibold">
          {t("writingHeading")}
        </h3>
        <p className="text-muted-foreground">{t("writingIntro")}</p>
        <p className="text-muted-foreground">
          {t("personStories", { name, count: badges.stories })}
          {next ? ` ${t("nextTier", { count: next.remaining, tier: t(`tiers.${next.tier.key}`) })}` : ""}
        </p>
        <ol className="mt-1 flex flex-col gap-1" data-testid="badge-ladder">
          {WRITING_TIERS.map((tier) => {
            const earned = badges.stories >= tier.min;
            const isCurrent = current?.key === tier.key;
            return (
              <li
                key={tier.key}
                className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", isCurrent && "bg-ember-soft")}
                data-tier={tier.key}
                data-earned={earned}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className="flex w-8 shrink-0 justify-center">
                  <TierIcon tier={tier.key} className={cn("h-6 w-auto", !earned && "opacity-40 grayscale")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{t(`tiers.${tier.key}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t("tierThreshold", { count: tier.min })}</span>
                </span>
                {earned ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-ember-text">
                    <Check className="size-4" aria-hidden />
                    {t("earned")}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
