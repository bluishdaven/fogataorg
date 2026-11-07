import { z } from "zod";

export const SERIES_TITLE_MAX = 120;
export const SERIES_DESCRIPTION_MAX = 280;

export const seriesInputSchema = z.object({
  title: z.string().trim().min(1, "title").max(SERIES_TITLE_MAX, "title"),
  description: z.string().trim().max(SERIES_DESCRIPTION_MAX, "description"),
});

export type SeriesPart = { slug: string; title: string };

/** Where a story sits in its series (counting only parts readers can see), and its neighbors. */
export function seriesNav(parts: SeriesPart[], currentSlug: string) {
  const index = parts.findIndex((part) => part.slug === currentSlug);
  if (index === -1) return null;
  return {
    position: index + 1,
    total: parts.length,
    previous: parts[index - 1] ?? null,
    next: parts[index + 1] ?? null,
  };
}

/** Positions after moving one part up or down (1-based, no gaps). */
export function moveInOrder<T extends { id: string }>(parts: T[], id: string, direction: "up" | "down"): T[] {
  const index = parts.findIndex((part) => part.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= parts.length) return parts;
  const next = [...parts];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
