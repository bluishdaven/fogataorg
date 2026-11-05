import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listTopicsWithCounts } from "@/lib/data/stories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Topics");
  return { title: t("title"), description: t("lede") };
}

export default async function TopicsPage() {
  const [t, locale, rows] = await Promise.all([getTranslations("Topics"), getLocale(), listTopicsWithCounts()]);
  const nameOf = (topic: (typeof rows)[number]) => (locale === "es" ? topic.nameEs : topic.nameEn);
  const topics = [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale));
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("lede")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link
              href={`/topics/${topic.slug}`}
              className="flex items-baseline justify-between rounded-xl border border-border px-4 py-3 hover:bg-accent"
            >
              <span className="font-serif text-lg font-semibold">{nameOf(topic)}</span>
              <span className="text-sm text-muted-foreground">{t("count", { count: topic.count })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
