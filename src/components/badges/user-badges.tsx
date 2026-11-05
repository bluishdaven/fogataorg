import { useTranslations } from "next-intl";
import { writingTier, type BadgeData } from "@/lib/domain/badges";
import { cn } from "@/lib/utils";
import { DonorIcon, TierIcon } from "./badge-icons";

/**
 * A person's badges, shown right after their name everywhere: the writing tier (highest reached)
 * and the donor badge. `icons` for bylines and lists (labelled for screen readers, with a
 * tooltip); `chips` for the profile page.
 */
export function UserBadges({
  badges,
  variant = "icons",
  className,
}: {
  badges: BadgeData | null | undefined;
  variant?: "icons" | "chips";
  className?: string;
}) {
  const t = useTranslations("Badges");
  if (!badges) return null;
  const tier = writingTier(badges.stories);
  if (!tier && !badges.donor) return null;

  const tierName = tier ? t(`tiers.${tier.key}`) : "";
  const tierLabel = tier ? t("tierLabel", { name: tierName, count: tier.min }) : "";
  const donorLabel = t("donorLabel", { name: t("donor") });

  if (variant === "chips") {
    return (
      <ul className={cn("flex flex-wrap gap-2", className)} data-testid="user-badges">
        {tier ? (
          <li
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border px-3 text-sm"
            title={tierLabel}
            data-badge={tier.key}
          >
            <TierIcon tier={tier.key} className="h-4 w-auto" />
            <span>{tierName}</span>
            <span className="sr-only">: {tierLabel}</span>
          </li>
        ) : null}
        {badges.donor ? (
          <li
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border px-3 text-sm"
            title={donorLabel}
            data-badge="donor"
          >
            <DonorIcon className="size-4" />
            <span>{t("donor")}</span>
            <span className="sr-only">: {donorLabel}</span>
          </li>
        ) : null}
      </ul>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 align-middle", className)} data-testid="user-badges">
      {tier ? (
        <span role="img" aria-label={tierLabel} title={tierLabel} data-badge={tier.key} className="inline-flex">
          <TierIcon tier={tier.key} className="h-[1.05em] w-auto" />
        </span>
      ) : null}
      {badges.donor ? (
        <span role="img" aria-label={donorLabel} title={donorLabel} data-badge="donor" className="inline-flex">
          <DonorIcon className="size-[1.05em]" />
        </span>
      ) : null}
    </span>
  );
}
