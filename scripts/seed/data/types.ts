export type SeedStory = {
  /** username from people.ts */
  author: string;
  title: string;
  subtitle: string;
  status: "draft" | "published" | "unlisted";
  /** Published this many days before the seed runs (ignored for drafts). */
  daysAgo: number;
  /** Topic slugs from people.ts, at most 5. */
  topics: string[];
  /** Markdown subset understood by ../markdown.ts. */
  body: string;
};
