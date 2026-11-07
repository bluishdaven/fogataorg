/**
 * Seeds a LOCAL database with 8 writers, 14 topics and 20 stories (10 ES, 10 EN).
 * Idempotent: re-running updates the same rows (matched by email / slug).
 *
 *   npm run db:seed              local Supabase only
 *   npm run db:seed -- --allow-remote   explicit opt-in for a non-local database
 */
import { createClient } from "@supabase/supabase-js";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readingTimeMinutes, tiptapToText } from "../../src/lib/domain/content";
import { MAX_TOPICS_PER_STORY } from "../../src/lib/domain/schemas";
import { slugify } from "../../src/lib/domain/slug";
import * as schema from "../../src/lib/db/schema";
import { authors, topicCatalog } from "./data/people";
import { storiesEn } from "./data/stories-en";
import { storiesEs } from "./data/stories-es";
import type { SeedStory } from "./data/types";
import { markdownToTiptap } from "./markdown";

const DAY = 24 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Run \`npm run setup:env\` first.`);
  return value;
}

function assertLocal(databaseUrl: string, apiUrl: string) {
  const local = (url: string) => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
  if ((!local(databaseUrl) || !local(apiUrl)) && !process.argv.includes("--allow-remote")) {
    throw new Error(
      "Refusing to seed a non-local database. Pass --allow-remote if you really mean it.",
    );
  }
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const apiUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  assertLocal(databaseUrl, apiUrl);

  const supabase = createClient(apiUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  const db = drizzle(sql, { schema });

  try {
    // 1. Writers: auth users (profiles are created by the sign-up trigger).
    const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const idByEmail = new Map(existing.users.map((u) => [u.email ?? "", u.id]));

    for (const author of authors) {
      if (!idByEmail.has(author.email)) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: author.email,
          email_confirm: true,
          user_metadata: { username: author.username, locale: author.locale, display_name: author.displayName },
        });
        if (error) throw error;
        idByEmail.set(author.email, data.user.id);
      }
      const id = idByEmail.get(author.email)!;
      await db
        .update(schema.profiles)
        .set({
          username: author.username,
          displayName: author.displayName,
          bio: author.bio,
          locale: author.locale,
          // Sample writers skip the welcome steps.
          onboardedAt: new Date(),
        })
        .where(eq(schema.profiles.id, id));
    }
    const idByUsername = new Map(authors.map((a) => [a.username, idByEmail.get(a.email)!]));
    console.log(`✓ ${authors.length} writers`);

    // 2. Topics.
    for (const topic of topicCatalog) {
      await db
        .insert(schema.topics)
        .values(topic)
        .onConflictDoUpdate({
          target: schema.topics.slug,
          set: { nameEn: topic.nameEn, nameEs: topic.nameEs },
        });
    }
    const topicRows = await db.select({ id: schema.topics.id, slug: schema.topics.slug }).from(schema.topics);
    const topicIdBySlug = new Map(topicRows.map((t) => [t.slug, t.id]));
    console.log(`✓ ${topicCatalog.length} topics`);

    // 3. Stories.
    const all: (SeedStory & { language: "en" | "es" })[] = [
      ...storiesEs.map((s) => ({ ...s, language: "es" as const })),
      ...storiesEn.map((s) => ({ ...s, language: "en" as const })),
    ];
    const now = Date.now();

    for (const [index, story] of all.entries()) {
      const authorId = idByUsername.get(story.author);
      if (!authorId) throw new Error(`Unknown author ${story.author}`);
      if (story.topics.length > MAX_TOPICS_PER_STORY) throw new Error(`Too many topics: ${story.title}`);

      const slug = slugify(story.title);
      const content = markdownToTiptap(story.body, `${story.author}/${slug}`);
      const contentText = tiptapToText(content);
      // Spread publish times across the day so ordering is stable and realistic.
      const publishedAt =
        story.status === "draft" ? null : new Date(now - story.daysAgo * DAY - (index % 9) * 47 * 60 * 1000);

      const values = {
        authorId,
        title: story.title,
        subtitle: story.subtitle,
        slug,
        content,
        contentText,
        language: story.language,
        status: story.status,
        publishedAt,
        readingTime: readingTimeMinutes(contentText, story.language),
      };

      const [row] = await db
        .insert(schema.stories)
        .values(values)
        .onConflictDoUpdate({
          target: [schema.stories.authorId, schema.stories.slug],
          set: { ...values, deletedAt: null },
        })
        .returning({ id: schema.stories.id });
      if (!row) throw new Error(`Failed to upsert ${story.title}`);

      await db.delete(schema.storyTopics).where(eq(schema.storyTopics.storyId, row.id));
      const topicIds = story.topics.map((slugValue) => {
        const id = topicIdBySlug.get(slugValue);
        if (!id) throw new Error(`Unknown topic ${slugValue}`);
        return id;
      });
      if (topicIds.length) {
        await db.insert(schema.storyTopics).values(topicIds.map((topicId) => ({ storyId: row.id, topicId })));
      }
    }

    const counts = await db
      .select({ status: schema.stories.status, language: schema.stories.language })
      .from(schema.stories)
      .where(
        and(
          inArray(schema.stories.authorId, [...idByUsername.values()]),
          inArray(
            schema.stories.slug,
            all.map((s) => slugify(s.title)),
          ),
        ),
      );
    const summary = counts.reduce<Record<string, number>>((acc, row) => {
      const key = `${row.language}/${row.status}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`✓ ${counts.length} stories`, summary);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
