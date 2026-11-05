import type { Metadata } from "next";
import Form from "next/form";
import NextLink from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StoryCard } from "@/components/story-card";
import { StoryListSkeleton } from "@/components/story-list-skeleton";
import { Link } from "@/i18n/navigation";
import { search } from "@/lib/data/search";
import { profilePath } from "@/lib/domain/handle-routes";
import { parseSearchParams } from "@/lib/domain/search";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/search">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Search");
  return { title: t("title"), robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  const t = await getTranslations("Search");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="sr-only">{t("title")}</h1>
      <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-muted" aria-hidden />}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className="mt-8"><StoryListSkeleton count={3} /></div>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchForm({ searchParams }: Pick<Props, "searchParams">) {
  const [{ q, lang }, t, locale] = await Promise.all([
    searchParams.then(parseSearchParams),
    getTranslations("Search"),
    getLocale(),
  ]);
  const filters = [
    { value: "all", label: t("allLanguages") },
    { value: "es", label: "Español" },
    { value: "en", label: "English" },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <Form action={`/${locale}/search`} role="search" className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          {t("label")}
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("placeholder")}
          autoFocus={!q}
          maxLength={100}
          enterKeyHint="search"
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-transparent px-4 text-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          data-testid="search-input"
        />
        {lang !== "all" ? <input type="hidden" name="lang" value={lang} /> : null}
        <button type="submit" className="h-12 rounded-xl bg-primary px-5 font-medium text-primary-foreground">
          {t("submit")}
        </button>
      </Form>
      <nav aria-label={t("languageFilter")} className="flex flex-wrap gap-2 text-sm">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={{ pathname: "/search", query: { ...(q ? { q } : {}), ...(filter.value === "all" ? {} : { lang: filter.value }) } }}
            aria-current={lang === filter.value ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1",
              lang === filter.value ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-accent",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

async function Results({ searchParams }: Pick<Props, "searchParams">) {
  const [{ q, lang }, t, locale] = await Promise.all([
    searchParams.then(parseSearchParams),
    getTranslations("Search"),
    getLocale(),
  ]);
  if (!q) return <p className="mt-8 text-muted-foreground">{t("hint")}</p>;

  const results = await search(q, lang);
  const total = results.stories.length + results.people.length + results.topics.length;
  if (total === 0) {
    return (
      <p className="mt-8 text-muted-foreground" role="status">
        {t("empty", { q })}
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      <p className="sr-only" role="status">
        {t("summary", { stories: results.stories.length, people: results.people.length, topics: results.topics.length })}
      </p>

      {results.topics.length ? (
        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("topics")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {results.topics.map((topic) => (
              <li key={topic.slug}>
                <Link href={`/topics/${topic.slug}`} className="block rounded-full bg-secondary px-3 py-1 text-sm hover:bg-accent">
                  {locale === "es" ? topic.nameEs : topic.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.people.length ? (
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("people")}
          </h2>
          <ul className="divide-y divide-border" data-testid="search-people">
            {results.people.map((person) => (
              <li key={person.username} className="py-3">
                <NextLink href={profilePath(person.username)} className="group flex flex-col">
                  <span className="font-medium group-hover:text-ember-text">{person.displayName || person.username}</span>
                  <span className="text-sm text-muted-foreground">@{person.username}</span>
                  {person.bio ? <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{person.bio}</span> : null}
                </NextLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.stories.length ? (
        <section aria-labelledby="stories-heading">
          <h2 id="stories-heading" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("stories")}
          </h2>
          <div data-testid="search-stories">
            {results.stories.map((story) => (
              <StoryCard key={`${story.author.username}/${story.slug}`} story={story} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
