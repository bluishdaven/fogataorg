import { useTranslations } from "next-intl";
import { writingTier, type BadgeData } from "@/lib/domain/badges";
import { cn } from "@/lib/utils";
import { DonorIcon, FoundingIcon, TierIcon } from "./badge-icons";

/**
 * A person's badges, shown right after their name everywhere: the donor badge first, then the
 * founding writer badge, then the writing tier (highest reached), as icons labelled for screen
 * readers, with a tooltip. Profiles use
 * BadgeChips (badge-guide.tsx) instead, which explain each badge.
 */
export function UserBadges({
  badges,
  className,
}: {
  badges: BadgeData | null | undefined;
  className?: string;
}) {
  const t = useTranslations("Badges");
  if (!badges) return null;
  const tier = writingTier(badges.stories);
  if (!tier && !badges.donor && !badges.founding) return null;

  const tierName = tier ? t(`tiers.${tier.key}`) : "";
  const tierLabel = tier ? t("tierLabel", { name: tierName, count: tier.min }) : "";
  const donorLabel = t("donorLabel", { name: t("donor") });
  const foundingLabel = badges.founding ? t("foundingLabel", { name: t("founding"), number: badges.founding }) : "";

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 align-middle", className)} data-testid="user-badges">
      {badges.donor ? (
        <span role="img" aria-label={donorLabel} title={donorLabel} data-badge="donor" className="inline-flex">
          <DonorIcon className="h-[1.1em] w-auto" />
        </span>
      ) : null}
      {badges.founding ? (
        <span role="img" aria-label={foundingLabel} title={foundingLabel} data-badge="founding" className="inline-flex">
          <FoundingIcon className="h-[1.05em] w-auto" />
        </span>
      ) : null}
      {tier ? (
        <span role="img" aria-label={tierLabel} title={tierLabel} data-badge={tier.key} className="inline-flex">
          <TierIcon tier={tier.key} className="h-[1.05em] w-auto" />
        </span>
      ) : null}
    </span>
  );
}
