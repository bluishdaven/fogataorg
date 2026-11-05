import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { profiles, stories, storyTopics, topics } from "@/lib/db/schema";
import { closeDb, expectPgError, PG, scenario, type Harness } from "./harness";

afterAll(closeDb);

const HOUR = 60 * 60 * 1000;

async function makeStory(
  h: Harness,
  authorId: string,
  overrides: Partial<typeof stories.$inferInsert> = {},
) {
  const [row] = await h.tx
    .insert(stories)
    .values({
      authorId,
      title: "Una historia",
      slug: `historia-${Math.random().toString(36).slice(2, 8)}`,
      language: "es",
      status: "published",
      publishedAt: new Date(Date.now() - HOUR),
      ...overrides,
    })
    .returning();
  return row!;
}

async function makeTopic(h: Harness, slug: string) {
  const [row] = await h.tx.insert(topics).values({ slug, nameEn: slug, nameEs: slug }).returning();
  return row!;
}

describe("withRls context", () => {
  it("runs as anon with no user, and as authenticated with auth.uid() set", async () => {
    await scenario(async (h) => {
      const userId = await h.createUser();
      const anon = await h.as(null, (tx) =>
        tx.execute<{ role: string; uid: string | null }>(sql`select current_user as role, auth.uid() as uid`),
      );
      expect(anon[0]).toEqual({ role: "anon", uid: null });

      const authed = await h.as(h.claimsFor(userId), (tx) =>
        tx.execute<{ role: string; uid: string | null }>(sql`select current_user as role, auth.uid() as uid`),
      );
      expect(authed[0]).toEqual({ role: "authenticated", uid: userId });
    });
  });
});

describe("profiles", () => {
  it("are created on sign-up with the requested username and locale", async () => {
    await scenario(async (h) => {
      const id = await h.createUser({
        metadata: { username: "Nueva_Voz", locale: "es", display_name: "Nueva Voz" },
      });
      const [profile] = await h.tx.select().from(profiles).where(eq(profiles.id, id));
      expect(profile).toMatchObject({ username: "Nueva_Voz", locale: "es", displayName: "Nueva Voz", isVerified: false });
    });
  });

  it("derive a username from the email and avoid case-insensitive collisions", async () => {
    await scenario(async (h) => {
      const first = await h.createUser({ email: "Ana.Maria@fogata.test" });
      const second = await h.createUser({ email: "anamaria@other.test" });
      const rows = await h.tx
        .select({ id: profiles.id, username: profiles.username })
        .from(profiles)
        .where(sql`${profiles.id} in (${first}, ${second})`);
      const byId = new Map(rows.map((r) => [r.id, r.username]));
      expect(byId.get(first)).toBe("anamaria");
      expect(byId.get(second)).toMatch(/^anamaria_\d{4}$/);
    });
  });

  it("are readable by anyone", async () => {
    await scenario(async (h) => {
      const id = await h.createUser();
      const rows = await h.as(null, (tx) => tx.select().from(profiles).where(eq(profiles.id, id)));
      expect(rows).toHaveLength(1);
    });
  });

  it("can be edited only by their owner", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const other = await h.createUser();

      const own = await h.as(h.claimsFor(owner), (tx) =>
        tx.update(profiles).set({ bio: "Hola" }).where(eq(profiles.id, owner)).returning({ id: profiles.id }),
      );
      expect(own).toHaveLength(1);

      const foreign = await h.as(h.claimsFor(other), (tx) =>
        tx.update(profiles).set({ bio: "Hackeado" }).where(eq(profiles.id, owner)).returning({ id: profiles.id }),
      );
      expect(foreign).toHaveLength(0);

      await expectPgError(
        h.as(null, (tx) => tx.update(profiles).set({ bio: "anon" }).where(eq(profiles.id, owner))),
        PG.insufficientPrivilege,
      );
    });
  });

  it("never let users verify themselves or insert/delete profiles", async () => {
    await scenario(async (h) => {
      const owner = await h.createUser();
      const claims = h.claimsFor(owner);
      await expectPgError(
        h.as(claims, (tx) => tx.update(profiles).set({ isVerified: true }).where(eq(profiles.id, owner))),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(claims, (tx) => tx.insert(profiles).values({ id: owner, username: "dupe_user" })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(claims, (tx) => tx.delete(profiles).where(eq(profiles.id, owner))),
        PG.insufficientPrivilege,
      );
    });
  });

  it("refresh updated_at on change", async () => {
    await scenario(async (h) => {
      const id = await h.createUser();
      await h.tx.execute(sql`update public.profiles set updated_at = now() - interval '1 day' where id = ${id}`);
      // now() is fixed per transaction, so compare against the backdated value.
      await h.tx.update(profiles).set({ bio: "nuevo" }).where(eq(profiles.id, id));
      const [row] = await h.tx
        .select({ fresh: sql<boolean>`${profiles.updatedAt} > now() - interval '1 hour'` })
        .from(profiles)
        .where(eq(profiles.id, id));
      expect(row?.fresh).toBe(true);
    });
  });
});

describe("topics", () => {
  it("are public and read-only for users", async () => {
    await scenario(async (h) => {
      const user = await h.createUser();
      await makeTopic(h, "rls-topic");
      const rows = await h.as(null, (tx) => tx.select().from(topics).where(eq(topics.slug, "rls-topic")));
      expect(rows).toHaveLength(1);
      await expectPgError(
        h.as(h.claimsFor(user), (tx) => tx.insert(topics).values({ slug: "nope", nameEn: "No", nameEs: "No" })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(h.claimsFor(user), (tx) => tx.update(topics).set({ nameEn: "Changed" }).where(eq(topics.slug, "rls-topic"))),
        PG.insufficientPrivilege,
      );
    });
  });
});

describe("stories", () => {
  it("show anonymous readers only live published and unlisted stories", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const published = await makeStory(h, author, { slug: "publicada" });
      const unlisted = await makeStory(h, author, { slug: "no-listada", status: "unlisted" });
      await makeStory(h, author, { slug: "borrador", status: "draft", publishedAt: null });
      await makeStory(h, author, { slug: "programada", status: "scheduled", publishedAt: new Date(Date.now() + HOUR) });
      await makeStory(h, author, { slug: "futura", status: "published", publishedAt: new Date(Date.now() + HOUR) });
      await makeStory(h, author, { slug: "borrada", deletedAt: new Date() });

      const visible = await h.as(null, (tx) =>
        tx.select({ id: stories.id }).from(stories).where(eq(stories.authorId, author)),
      );
      expect(visible.map((s) => s.id).sort()).toEqual([published.id, unlisted.id].sort());
    });
  });

  it("let authors see all of their own stories, but not other people's drafts", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const other = await h.createUser();
      const draft = await makeStory(h, author, { slug: "mi-borrador", status: "draft", publishedAt: null });

      const own = await h.as(h.claimsFor(author), (tx) =>
        tx.select({ id: stories.id }).from(stories).where(eq(stories.id, draft.id)),
      );
      expect(own).toHaveLength(1);

      const foreign = await h.as(h.claimsFor(other), (tx) =>
        tx.select({ id: stories.id }).from(stories).where(eq(stories.id, draft.id)),
      );
      expect(foreign).toHaveLength(0);
    });
  });

  it("can only be created by the signed-in author for themselves", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const victim = await h.createUser();
      const values = { title: "Nueva", slug: "nueva", language: "es" as const };

      const created = await h.as(h.claimsFor(author), (tx) =>
        tx.insert(stories).values({ ...values, authorId: author }).returning({ id: stories.id }),
      );
      expect(created).toHaveLength(1);

      await expectPgError(
        h.as(h.claimsFor(author), (tx) => tx.insert(stories).values({ ...values, slug: "ajena", authorId: victim })),
        PG.insufficientPrivilege,
      );
      await expectPgError(
        h.as(null, (tx) => tx.insert(stories).values({ ...values, slug: "anonima", authorId: author })),
        PG.insufficientPrivilege,
      );
    });
  });

  it("can only be edited or soft-deleted by their author, and never hard-deleted", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const other = await h.createUser();
      const story = await makeStory(h, author);

      const foreign = await h.as(h.claimsFor(other), (tx) =>
        tx.update(stories).set({ title: "Robada" }).where(eq(stories.id, story.id)).returning({ id: stories.id }),
      );
      expect(foreign).toHaveLength(0);

      await expectPgError(
        h.as(h.claimsFor(author), (tx) => tx.update(stories).set({ authorId: other }).where(eq(stories.id, story.id))),
        PG.insufficientPrivilege,
      );

      const softDeleted = await h.as(h.claimsFor(author), (tx) =>
        tx.update(stories).set({ deletedAt: new Date() }).where(eq(stories.id, story.id)).returning({ id: stories.id }),
      );
      expect(softDeleted).toHaveLength(1);

      await expectPgError(
        h.as(h.claimsFor(author), (tx) => tx.delete(stories).where(eq(stories.id, story.id))),
        PG.insufficientPrivilege,
      );
    });
  });

  it("enforce unique slugs per author and require a publish date when live", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      await makeStory(h, author, { slug: "repetida" });
      const insert = (values: Partial<typeof stories.$inferInsert>) =>
        h.savepoint((tx) =>
          tx.insert(stories).values({ authorId: author, title: "Otra", language: "es", slug: "x", ...values }),
        );
      await expectPgError(insert({ slug: "repetida" }), PG.uniqueViolation);
      await expectPgError(insert({ slug: "sin-fecha", status: "published", publishedAt: null }), PG.checkViolation);
      await expectPgError(insert({ slug: "Mayúsculas" }), PG.checkViolation);
    });
  });
});

describe("story covers", () => {
  it("let authors set a credited cover, with bounded alt text", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const story = await makeStory(h, author);
      const credit = {
        source: "unsplash" as const,
        photoId: "Fg4tA0campfire",
        authorName: "Ana Ruiz",
        authorUrl: "https://unsplash.com/@anaruiz_photo",
        photoUrl: "https://unsplash.com/photos/x-Fg4tA0campfire",
      };
      const [updated] = await h.as(h.claimsFor(author), (tx) =>
        tx
          .update(stories)
          .set({ coverUrl: "https://images.unsplash.com/photo-1?ixid=x", coverAlt: "Una fogata en la playa", coverCredit: credit })
          .where(eq(stories.id, story.id))
          .returning({ coverCredit: stories.coverCredit }),
      );
      expect(updated?.coverCredit).toEqual(credit);

      await expectPgError(
        h.as(h.claimsFor(author), (tx) =>
          tx.update(stories).set({ coverAlt: "x".repeat(301) }).where(eq(stories.id, story.id)),
        ),
        PG.checkViolation,
      );
    });
  });
});

describe("story editing", () => {
  it("lets drafts be untitled but never publishes an untitled story", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const [draft] = await h.as(h.claimsFor(author), (tx) =>
        tx
          .insert(stories)
          .values({ authorId: author, title: "", slug: "draft-0123456789ab", language: "es" })
          .returning({ id: stories.id }),
      );
      expect(draft?.id).toBeTruthy();
      await expectPgError(
        h.as(h.claimsFor(author), (tx) =>
          tx.update(stories).set({ status: "published", publishedAt: new Date() }).where(eq(stories.id, draft!.id)),
        ),
        PG.checkViolation,
      );
    });
  });

  it("keeps pending changes private to the author", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const other = await h.createUser();
      const story = await makeStory(h, author);
      const pending = { title: "Nuevo título", subtitle: "", content: { type: "doc", content: [] } };
      const updated = await h.as(h.claimsFor(author), (tx) =>
        tx
          .update(stories)
          .set({ pendingChanges: pending, revision: sql`${stories.revision} + 1` })
          .where(eq(stories.id, story.id))
          .returning({ revision: stories.revision }),
      );
      expect(updated[0]?.revision).toBe(1);

      const foreign = await h.as(h.claimsFor(other), (tx) =>
        tx.update(stories).set({ pendingChanges: null }).where(eq(stories.id, story.id)).returning({ id: stories.id }),
      );
      expect(foreign).toHaveLength(0);
    });
  });
});

describe("story image storage", () => {
  const insertObject = (h: Harness, claims: Parameters<Harness["as"]>[0], bucket: string, name: string) =>
    h.as(claims, (tx) => tx.execute(sql`insert into storage.objects (bucket_id, name) values (${bucket}, ${name})`));

  it("is a public bucket limited to images up to 10 MB", async () => {
    await scenario(async (h) => {
      const [bucket] = await h.tx.execute<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
        sql`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'story-images'`,
      );
      expect(bucket?.public).toBe(true);
      expect(Number(bucket?.file_size_limit)).toBe(10_485_760);
      expect(bucket?.allowed_mime_types).toEqual(expect.arrayContaining(["image/webp", "image/jpeg", "image/png"]));
    });
  });

  it("lets writers upload only into their own folder", async () => {
    await scenario(async (h) => {
      const writer = await h.createUser();
      const other = await h.createUser();
      await insertObject(h, h.claimsFor(writer), "story-images", `${writer}/photo.webp`);
      await expectPgError(insertObject(h, h.claimsFor(writer), "story-images", `${other}/photo.webp`), PG.insufficientPrivilege);
      await expectPgError(insertObject(h, h.claimsFor(writer), "story-images", "photo.webp"), PG.insufficientPrivilege);
      await expectPgError(insertObject(h, null, "story-images", `${writer}/anon.webp`), PG.insufficientPrivilege);
    });
  });

  it("limits deletes to the writer's own folder", async () => {
    // Supabase blocks direct SQL deletes on storage.objects (deletes go through the Storage API,
    // which applies these policies), so check the policy itself.
    await scenario(async (h) => {
      const policies = await h.tx.execute<{ policyname: string; cmd: string; qual: string | null }>(
        sql`select policyname, cmd, qual from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'story_images_%'`,
      );
      const del = policies.find((p) => p.cmd === "DELETE");
      expect(del?.qual).toContain("story-images");
      expect(del?.qual).toContain("auth.uid()");
      expect(del?.qual).toContain("foldername");
    });
  });
});

describe("story_topics", () => {
  it("are visible only when the story is visible", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const topic = await makeTopic(h, "visible-topic");
      const live = await makeStory(h, author, { slug: "viva" });
      const draft = await makeStory(h, author, { slug: "oculta", status: "draft", publishedAt: null });
      await h.tx.insert(storyTopics).values([
        { storyId: live.id, topicId: topic.id },
        { storyId: draft.id, topicId: topic.id },
      ]);

      const rows = await h.as(null, (tx) =>
        tx.select({ storyId: storyTopics.storyId }).from(storyTopics).where(eq(storyTopics.topicId, topic.id)),
      );
      expect(rows.map((r) => r.storyId)).toEqual([live.id]);
    });
  });

  it("can be managed only by the story's author", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const other = await h.createUser();
      const topic = await makeTopic(h, "managed-topic");
      const story = await makeStory(h, author);

      await h.as(h.claimsFor(author), (tx) => tx.insert(storyTopics).values({ storyId: story.id, topicId: topic.id }));
      await expectPgError(
        h.as(h.claimsFor(other), (tx) => tx.insert(storyTopics).values({ storyId: story.id, topicId: topic.id })),
        PG.insufficientPrivilege,
      );
      const removedByOther = await h.as(h.claimsFor(other), (tx) =>
        tx.delete(storyTopics).where(eq(storyTopics.storyId, story.id)).returning({ id: storyTopics.topicId }),
      );
      expect(removedByOther).toHaveLength(0);
    });
  });

  it("allow at most five topics per story", async () => {
    await scenario(async (h) => {
      const author = await h.createUser();
      const story = await makeStory(h, author);
      const created = await Promise.all(
        ["t-uno", "t-dos", "t-tres", "t-cuatro", "t-cinco", "t-seis"].map((slug) => makeTopic(h, slug)),
      );
      for (const topic of created.slice(0, 5)) {
        await h.as(h.claimsFor(author), (tx) => tx.insert(storyTopics).values({ storyId: story.id, topicId: topic.id }));
      }
      await expectPgError(
        h.as(h.claimsFor(author), (tx) => tx.insert(storyTopics).values({ storyId: story.id, topicId: created[5]!.id })),
        PG.checkViolation,
      );
    });
  });
});
