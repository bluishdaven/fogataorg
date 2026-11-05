import { PenLine } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createDraft } from "@/app/actions/stories";
import { Button } from "@/components/ui/button";

/** Starts a new draft (a POST, so link prefetching can never create drafts). */
export async function WriteButton() {
  const [t, locale] = await Promise.all([getTranslations("Nav"), getLocale()]);
  return (
    <form action={createDraft}>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" size="sm" aria-label={t("write")} data-testid="write-button">
        <PenLine aria-hidden />
        <span className="hidden sm:inline">{t("write")}</span>
      </Button>
    </form>
  );
}
