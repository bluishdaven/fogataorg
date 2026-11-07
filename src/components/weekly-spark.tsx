import { Flame } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createDraft } from "@/app/actions/stories";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentPrompt } from "@/lib/data/prompts";
import { promptText } from "@/lib/domain/prompts";

/** This week's spark on the home page: the prompt, "Write about it" and the entries so far. */
export async function WeeklySpark() {
  const prompt = await getCurrentPrompt();
  if (!prompt) return null;
  const [t, locale] = await Promise.all([getTranslations("Spark"), getLocale()]);
  return (
    <section aria-labelledby="spark-title" className="mb-10 max-w-3xl rounded-2xl border border-border border-l-4 border-l-ember bg-card p-5" data-testid="weekly-spark">
      <h2 id="spark-title" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ember-text uppercase">
        <Flame className="size-4" aria-hidden />
        {t("eyebrow")}
      </h2>
      <p className="mt-2 font-serif text-2xl leading-snug text-balance">{promptText(prompt, locale)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <form action={createDraft}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="promptId" value={prompt.id} />
          <Button type="submit" data-testid="spark-write">
            {t("write")}
          </Button>
        </form>
        <Link href={`/prompts/${prompt.weekOf}`} className="text-sm font-medium text-ember-text underline underline-offset-4">
          {prompt.entries ? t("entries", { count: prompt.entries }) : t("noEntriesYet")}
        </Link>
      </div>
    </section>
  );
}
