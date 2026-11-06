import { jsonLd } from "@/lib/domain/seo";

/**
 * Structured data for search engines. The one place that writes raw HTML: jsonLd() escapes <, >, &
 * and line separators, so titles and bios can't close the script or run as code.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
