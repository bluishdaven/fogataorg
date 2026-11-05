import { z } from "zod";

/** Search input rules shared by the search page and its data layer. */

export const SEARCH_QUERY_MAX = 100;

export const searchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .max(SEARCH_QUERY_MAX)
    .transform((value) => value.replace(/\s+/g, " ")),
  lang: z.enum(["all", "en", "es"]).catch("all"),
});
export type SearchParams = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(input: { q?: unknown; lang?: unknown }): SearchParams {
  const parsed = searchParamsSchema.safeParse({
    q: typeof input.q === "string" ? input.q.slice(0, SEARCH_QUERY_MAX * 2) : "",
    lang: input.lang,
  });
  return parsed.success ? parsed.data : { q: "", lang: "all" };
}

/** Lower-cased, accent-free form used for cache keys and similarity matching. */
export function normalizeQuery(q: string): string {
  return q.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim();
}
