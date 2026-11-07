import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { FlameLogo } from "@/components/flame-logo";
import { localeAlternates } from "@/lib/domain/seo";

type Section = { title: string; body: string };

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Manifesto"), getLocale()]);
  return { title: t("title"), description: t("description"), alternates: localeAlternates(locale, "/manifesto") };
}

/** What Fogata believes, in the founder's voice, signed by Fogata.org. Static in both languages. */
export default async function ManifestoPage() {
  const t = await getTranslations("Manifesto");
  const sections = t.raw("sections") as Section[];

  return (
    <article className="px-4 py-12 sm:py-16" data-testid="manifesto">
      <header className="mx-auto mb-10 flex max-w-[var(--measure)] flex-col gap-5">
        <FlameLogo className="h-10 w-auto self-start" />
        <h1 className="font-serif text-4xl leading-tight font-semibold text-balance sm:text-title">{t("title")}</h1>
        <p className="font-serif text-xl leading-relaxed text-pretty text-muted-foreground sm:text-2xl">{t("lede")}</p>
      </header>
      <div className="prose-fogata mx-auto">
        {sections.map((section, index) => (
          <Fragment key={section.title}>
            <h2>
              <span className="mr-2 text-ember-text" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.title}
            </h2>
            <p>{section.body}</p>
          </Fragment>
        ))}
        <hr />
        <p>{t("closing")}</p>
        <p className="flex items-center justify-end gap-2 font-medium not-italic" data-testid="manifesto-signature">
          <FlameLogo className="h-5 w-auto" animated={false} />
          <span>— {t("signature")}</span>
        </p>
      </div>
    </article>
  );
}
