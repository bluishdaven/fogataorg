import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { withUnsplashUtm, type ImageCredit } from "@/lib/domain/unsplash";
import { cn } from "@/lib/utils";

/**
 * "Photo by <name> on Unsplash", linking the photographer and Unsplash with
 * referral params. Required wherever an Unsplash photo is shown.
 */
export function UnsplashCredit({ credit, className }: { credit: ImageCredit; className?: string }) {
  const t = useTranslations("Unsplash");
  const link = (href: string) =>
    function CreditLink(chunks: ReactNode) {
      return (
        <a
          href={withUnsplashUtm(href)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {chunks}
        </a>
      );
    };

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {t.rich("credit", {
        name: credit.authorName,
        author: link(credit.authorUrl),
        unsplash: link("https://unsplash.com/"),
      })}
    </p>
  );
}
