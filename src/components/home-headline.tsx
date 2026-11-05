import { headlineCss } from "@/lib/domain/headlines";

/**
 * The home page's rotating headline. Every option is rendered; `HEADLINE_SCRIPT` (root layout)
 * picks one before paint, so there's no flash and the page stays static. Hidden options use
 * display:none, so assistive tech and the heading's accessible name only get the shown one.
 */
export function HomeHeadline({ id, headlines, className }: { id: string; headlines: string[]; className?: string }) {
  return (
    <>
      <style>{headlineCss(headlines.length)}</style>
      <h1 id={id} className={className} data-testid="home-headline">
        {headlines.map((text, index) => (
          <span key={index} data-headline-option={index}>
            {text}
          </span>
        ))}
      </h1>
    </>
  );
}
