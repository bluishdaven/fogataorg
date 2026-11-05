"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { submitToCircle } from "@/app/actions/circles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Story = {
  id: string;
  title: string;
  activeCircle: { status: "pending" | "accepted" | "declined"; circleName: string } | null;
};

/** Offer one of your published stories to a circle. */
export function SubmitStoryDialog({ circleId, circleName, stories }: { circleId: string; circleName: string; stories: Story[] }) {
  const t = useTranslations("Circles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async (storyId: string) => {
    setBusy(storyId);
    const result = await submitToCircle({ circleId, storyId });
    setBusy(null);
    if (!result.ok) {
      toast.error(t(`errors.${result.errors[0] ?? "invalid"}`));
      return;
    }
    toast.success(result.status === "accepted" ? t("submittedAccepted", { circle: circleName }) : t("submittedPending", { circle: circleName }));
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" data-testid="submit-story">
          <Send />
          {t("submitStory")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("submitTitle", { circle: circleName })}</DialogTitle>
          <DialogDescription>{t("submitDescription")}</DialogDescription>
        </DialogHeader>
        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStoriesToSubmit")}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {stories.map((story) => (
              <li key={story.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-serif font-semibold">{story.title}</span>
                  {story.activeCircle ? (
                    <span className="text-xs text-muted-foreground">
                      {story.activeCircle.status === "pending"
                        ? t("pendingIn", { circle: story.activeCircle.circleName })
                        : t("publishedIn", { circle: story.activeCircle.circleName })}
                    </span>
                  ) : null}
                </span>
                <Button size="sm" disabled={Boolean(story.activeCircle) || busy !== null} onClick={() => void submit(story.id)}>
                  {busy === story.id ? t("submitting") : t("submit")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
