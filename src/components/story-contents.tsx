import { ListTree } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { TiptapDoc } from "@/lib/domain/content";
import { headingsOf } from "@/lib/domain/story-doc";

/** Stories with three or more sections get a table of contents (a plain disclosure, no script). */
export const MIN_SECTIONS = 3;

export async function StoryContents({ doc, lang }: { doc: TiptapDoc; lang: string }) {
  const headings = headingsOf(doc).filter((heading) => heading.id && heading.text.trim());
  if (headings.length < MIN_SECTIONS) return null;
  const t = await getTranslations("Story");
  return (
    <nav aria-label={t("contents")} className="mx-auto mb-10 max-w-[var(--measure)]" data-testid="story-contents">
      <details className="group rounded-xl border border-border/70 bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ListTree className="size-4 text-muted-foreground" aria-hidden />
          {t("contents")}
          <span className="text-muted-foreground">· {t("sections", { count: headings.length })}</span>
        </summary>
        <ol className="flex flex-col gap-1 px-4 pb-4 font-serif" lang={lang}>
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 3 ? "pl-5 text-sm" : ""}>
              <a href={`#p-${heading.id}`} className="block py-1 text-pretty hover:text-ember-text">
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}
