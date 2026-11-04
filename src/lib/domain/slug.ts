/**
 * URL slugs for stories, topics and circles. Accents are folded so
 * "Canción de cuna" → "cancion-de-cuna"; ñ becomes n.
 */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/** Appends -2, -3… until `isTaken` returns false. */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean> | boolean,
): Promise<string> {
  const root = base || "story";
  if (!(await isTaken(root))) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Could not find a free slug for "${root}"`);
}
