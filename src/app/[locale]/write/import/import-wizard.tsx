"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { importStory } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { countWords, tiptapToText, type TiptapDoc } from "@/lib/domain/content";
import { htmlToDoc } from "@/lib/domain/import/html-to-doc";
import { guessLanguage } from "@/lib/domain/import/language";
import { readExport, type ImportedPost, type ImportSource } from "@/lib/domain/import/sources";
import { ImportFileError } from "@/lib/domain/import/zip";
import type { Locale } from "@/lib/domain/locale";

type Candidate = ImportedPost & { doc: TiptapDoc; words: number; language: Locale; selected: boolean };
type Outcome = { key: string; title: string; id?: string; failedImages?: number; error?: string };

const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };

export function ImportWizard({ locale }: { locale: Locale }) {
  const t = useTranslations("Import");
  const inputId = useId();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [posts, setPosts] = useState<Candidate[]>([]);
  const [keepCanonical, setKeepCanonical] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const read = async (file: File) => {
    setReading(true);
    setError(null);
    setPosts([]);
    setOutcomes([]);
    try {
      const result = await readExport({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, new DOMParser());
      const parser = new DOMParser();
      const candidates = result.posts.map((post) => {
        const body = parser.parseFromString(`<body>${post.html}</body>`, "text/html").body;
        const { doc } = htmlToDoc(body, { newId: () => crypto.randomUUID(), title: post.title, subtitle: post.subtitle });
        const text = tiptapToText(doc);
        return { ...post, doc, words: countWords(text), language: guessLanguage(`${post.title} ${text}`, locale), selected: !post.draft };
      });
      if (!candidates.length) throw new ImportFileError("empty");
      setSource(result.source);
      setPosts(candidates);
    } catch (problem) {
      setError(problem instanceof ImportFileError ? t(`errors.${problem.reason}`) : t("errors.unknownFormat"));
    } finally {
      setReading(false);
    }
  };

  const chosen = posts.filter((post) => post.selected);
  const update = (key: string, change: Partial<Candidate>) =>
    setPosts((list) => list.map((post) => (post.key === key ? { ...post, ...change } : post)));

  const run = async () => {
    setProgress({ done: 0, total: chosen.length });
    const results: Outcome[] = [];
    for (const [index, post] of chosen.entries()) {
      const result = await importStory({
        title: post.title.slice(0, 200),
        subtitle: post.subtitle.slice(0, 280),
        language: post.language,
        canonicalUrl: keepCanonical && post.sourceUrl?.startsWith("https://") ? post.sourceUrl : null,
        // Server actions only take plain JSON.
        doc: JSON.parse(JSON.stringify(post.doc)),
      }).catch(() => ({ ok: false as const, error: "invalid" as const }));
      results.push(
        result.ok
          ? { key: post.key, title: post.title, id: result.id, failedImages: result.images.failed }
          : { key: post.key, title: post.title, error: t(`errors.${result.error === "tooLarge" ? "storyTooLong" : result.error}`) },
      );
      setOutcomes([...results]);
      setProgress({ done: index + 1, total: chosen.length });
      if (!result.ok && result.error === "rateLimited") break;
    }
    setPosts([]);
  };

  const imported = outcomes.filter((outcome) => outcome.id);
  const importing = progress !== null && progress.done < progress.total;

  return (
    <div className="flex flex-col gap-8">
      {!posts.length && !outcomes.length ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-2xl font-semibold">{t("howTitle")}</h2>
          <ul className="flex flex-col gap-2 text-sm text-pretty">
            <li><strong>Medium:</strong> {t("howMedium")}</li>
            <li><strong>Substack:</strong> {t("howSubstack")}</li>
            <li><strong>WordPress:</strong> {t("howWordPress")}</li>
          </ul>
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="font-medium">
              {t("fileLabel")}
            </label>
            <input
              id={inputId}
              type="file"
              accept=".zip,.xml,.html,.htm,application/zip,text/xml,text/html"
              disabled={reading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void read(file);
              }}
              className="text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-primary file:px-4 file:text-primary-foreground sm:file:min-h-9"
              data-testid="import-file"
            />
            <p className="text-sm text-muted-foreground">{t("privacyNote")}</p>
          </div>
          {reading ? <p role="status" className="text-sm">{t("reading")}</p> : null}
          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}

      {posts.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="import-found">
          <h2 id="import-found" className="font-serif text-2xl font-semibold">
            {t("found", { count: posts.length, source: source ? t(`sources.${source}`) : "" })}
          </h2>
          <p className="text-sm text-muted-foreground">{t("foundHint")}</p>
          {posts.some((post) => post.sourceUrl) ? (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={keepCanonical} onChange={(event) => setKeepCanonical(event.target.checked)} className="mt-1 size-4" />
              <span>
                <span className="font-medium">{t("canonical")}</span>
                <span className="block text-muted-foreground">{t("canonicalHint")}</span>
              </span>
            </label>
          ) : null}
          <ul className="divide-y divide-border rounded-xl border border-border" data-testid="import-posts">
            {posts.map((post) => (
              <li key={post.key} className="flex flex-wrap items-center gap-3 p-4">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input type="checkbox" checked={post.selected} onChange={(event) => update(post.key, { selected: event.target.checked })} className="mt-1 size-4" />
                  <span className="min-w-0">
                    <span className="block font-medium">{post.title || t("untitled")}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[post.date ? new Date(post.date).toLocaleDateString(locale, { timeZone: "UTC", dateStyle: "medium" }) : null, t("words", { count: post.words }), post.draft ? t("draft") : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">{t("languageOf", { title: post.title || t("untitled") })}</span>
                  <select
                    value={post.language}
                    onChange={(event) => update(post.key, { language: event.target.value as Locale })}
                    className="min-h-11 rounded-full border border-input bg-background px-3 sm:min-h-8"
                  >
                    {(["es", "en"] as const).map((code) => (
                      <option key={code} value={code}>
                        {LANGUAGE_NAMES[code]}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" disabled={!chosen.length || importing} onClick={() => void run()} data-testid="import-run">
              {t("run", { count: chosen.length })}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPosts([])} disabled={importing}>
              {t("chooseAnother")}
            </Button>
          </div>
        </section>
      ) : null}

      {progress ? (
        <section className="flex flex-col gap-3" aria-labelledby="import-progress">
          <h2 id="import-progress" className="font-serif text-2xl font-semibold">
            {importing ? t("importing") : t("done", { count: imported.length })}
          </h2>
          <p role="status" className="text-sm" data-testid="import-status">
            {t("progress", { done: progress.done, total: progress.total })}
          </p>
          <progress value={progress.done} max={progress.total} className="h-2 w-full accent-ember" aria-hidden />
          <ul className="flex flex-col gap-2 text-sm" data-testid="import-results">
            {outcomes.map((outcome) => (
              <li key={outcome.key}>
                {outcome.id ? (
                  <>
                    <Link href={`/write/${outcome.id}`} className="font-medium text-ember-text underline underline-offset-4">
                      {outcome.title || t("untitled")}
                    </Link>
                    {outcome.failedImages ? <span className="text-muted-foreground"> · {t("imagesFailed", { count: outcome.failedImages })}</span> : null}
                  </>
                ) : (
                  <span className="text-destructive">
                    {outcome.title || t("untitled")}: {outcome.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!importing ? (
            <p className="text-sm">
              {t("doneHint")}{" "}
              <Link href="/me/stories" className="font-medium text-ember-text underline underline-offset-4">
                {t("myStories")}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
