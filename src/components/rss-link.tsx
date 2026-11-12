import { Rss } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/** A small link to a page's RSS feed (a plain <a>: feeds are route handlers, not pages). */
export async function RssLink({ href, name, className }: { href: string; name: string; className?: string }) {
  const t = await getTranslations("Rss");
  return (
    <a
      href={href}
      className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-ember-text", className)}
      aria-label={t("linkLabel", { name })}
      data-testid="rss-link"
    >
      <Rss className="size-3.5" aria-hidden />
      {t("link")}
    </a>
  );
}
