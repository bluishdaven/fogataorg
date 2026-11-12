"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setFeatured } from "@/app/actions/prompts";
import { Button } from "@/components/ui/button";

/** Admins feature an entry on its spark's page, or take it back. */
export function FeatureToggle({ promptId, storyId, featured, title }: { promptId: string; storyId: string; featured: boolean; title: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={featured ? "secondary" : "outline"}
      disabled={pending}
      aria-pressed={featured}
      aria-label={t("featureLabel", { title })}
      onClick={() =>
        startTransition(async () => {
          const result = await setFeatured({ promptId, storyId, featured: !featured });
          if (result.ok) {
            toast.success(t(featured ? "unfeatured" : "featuredToast"));
            router.refresh();
          } else {
            toast.error(t(result.error === "limit" ? "featureLimit" : "promptErrors.failed"));
          }
        })
      }
      data-testid="feature-toggle"
    >
      <Star aria-hidden className={featured ? "fill-current" : undefined} />
      {t("feature")}
    </Button>
  );
}
