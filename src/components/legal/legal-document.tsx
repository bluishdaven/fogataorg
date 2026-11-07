import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/domain/links";

export type LegalDoc = "terms" | "privacy" | "content";
type Section = { title: string; paragraphs?: string[]; items?: string[] };
type Doc = { title: string; description: string; intro: string; sections: Section[] };

export const LEGAL_PATHS: Record<LegalDoc, string> = {
  terms: "/terms",
  privacy: "/privacy",
  content: "/content-policy",
};

export async function legalDoc(doc: LegalDoc): Promise<Doc> {
  const t = await getTranslations("Legal");
  // Whole documents are objects, which next-intl's key types don't cover; the shape is checked by
  // the messages test (same keys in both languages).
  return (t.raw as (key: string) => unknown)(`${doc}Doc`) as Doc;
}

/** Terms, privacy and content policy share one plain, readable layout. */
export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const [t, data] = await Promise.all([getTranslations("Legal"), legalDoc(doc)]);
  const others = (Object.keys(LEGAL_PATHS) as LegalDoc[]).filter((d) => d !== doc);

  return (
    <article className="px-4 py-12 sm:py-16" data-testid={`legal-${doc}`}>
      <header className="mx-auto mb-8 flex max-w-[var(--measure)] flex-col gap-3">
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance">{data.title}</h1>
        <p className="text-sm text-muted-foreground">{t("updated")}</p>
        <p className="text-lg text-pretty">{data.intro}</p>
      </header>
      <div className="mx-auto flex max-w-[var(--measure)] flex-col gap-7 leading-relaxed">
        {data.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="font-serif text-2xl font-semibold">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-pretty">
                {paragraph}
              </p>
            ))}
            {section.items ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ember-text">
                {section.items.map((item) => (
                  <li key={item.slice(0, 40)} className="text-pretty">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <footer className="mt-4 flex flex-col gap-3 border-t border-border pt-6 text-sm">
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ember-text underline underline-offset-2">
              {t("contact")}
            </a>
          </p>
          <nav aria-label={t("related")} className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
            <span>{t("related")}:</span>
            {others.map((other) => (
              <Link key={other} href={LEGAL_PATHS[other]} className="underline underline-offset-2 hover:text-foreground">
                {t(other)}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </article>
  );
}
