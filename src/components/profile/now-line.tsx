import { BookOpen, Headphones, Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NowFocus } from "@/lib/domain/profile";
import { cn } from "@/lib/utils";

/** "Now reading / watching / listening to: …" with a matching icon (profiles and the writer card). */
export function NowLine({ focus, text, className }: { focus: NowFocus; text: string; className?: string }) {
  const t = useTranslations("Profile");
  const Icon = focus === "watching" ? Tv : focus === "listening" ? Headphones : BookOpen;
  return (
    <p className={cn("flex items-start gap-2 text-sm", className)} data-testid="now-line">
      <Icon className="mt-0.5 size-4 shrink-0 text-ember-text" aria-hidden />
      <span>
        <span className="font-medium">{t("now", { focus })}:</span>{" "}
        <span className="font-serif text-base italic">{text}</span>
      </span>
    </p>
  );
}
