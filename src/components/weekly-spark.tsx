import { Flame, Star } from "lucide-react";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createDraft } from "@/app/actions/stories";
import { EmberDrift } from "@/components/ember-drift";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCurrentPrompt, getLastWeekFeatured } from "@/lib/data/prompts";
import { storyPath } from "@/lib/domain/handle-routes";
import { promptText } from "@/lib/domain/prompts";

/**
 * This week's spark on the home page: the prompt, "Write about it" and the entries so far, then the
 * entries featured on last week's spark.
 */
export async function WeeklySpark() {
  const [prompt, lastWeek] = await Promise.all([getCurrentPrompt(), getLastWeekFeatured()]);
  if (!prompt && !lastWeek) return null;
  const [t, locale] = await Promise.all([getTranslations("Spark"), getLocale()]);
  return (
    <section
      aria-labelledby="spark-title"
      className="relative mb-10 max-w-3xl overflow-hidden rounded-2xl border border-border border-l-4 border-l-ember bg-card p-5"
      data-testid="weekly-spark"
    >
      <EmberDrift className="left-auto w-40" count={5} />
      {prompt ? (
        <>
          <h2 id="spark-title" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ember-text uppercase">
            <Flame className="size-4" aria-hidden />
            {t("eyebrow")}
          </h2>
          <p className="relative mt-2 font-serif text-2xl leading-snug text-balance">{promptText(prompt, locale)}</p>
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
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
        </>
      ) : null}
      {lastWeek ? (
        <div className={prompt ? "relative mt-5 border-t border-border/70 pt-4" : "relative"} data-testid="last-week-featured">
          <h3 id={prompt ? undefined : "spark-title"} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Star className="size-4 fill-current text-ember-text" aria-hidden />
            <span>
              {t("lastWeekFeatured")}{" "}
              <Link href={`/prompts/${lastWeek.weekOf}`} className="font-normal underline underline-offset-4 hover:text-ember-text">
                {promptText(lastWeek, locale)}
              </Link>
            </span>
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {lastWeek.stories.map((story) => (
              <li key={`${story.author.username}/${story.slug}`} className="text-[0.9375rem]">
                <NextLink href={storyPath(story.author.username, story.slug)} className="font-serif font-semibold hover:text-ember-text" lang={story.language}>
                  {story.title}
                </NextLink>
                <span className="text-muted-foreground"> · {story.author.displayName || story.author.username}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
