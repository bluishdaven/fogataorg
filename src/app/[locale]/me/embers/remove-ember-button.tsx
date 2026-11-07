"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeHighlight } from "@/app/actions/highlights";
import { Button } from "@/components/ui/button";

export function RemoveEmberButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations("Embers");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={t("removeLabel", { title })}
      onClick={() =>
        startTransition(async () => {
          const result = await removeHighlight({ id });
          if (result.ok) {
            toast(t("removed"));
            router.refresh();
          } else {
            toast.error(t("failed"));
          }
        })
      }
      data-testid="remove-ember"
    >
      {t("remove")}
    </Button>
  );
}
