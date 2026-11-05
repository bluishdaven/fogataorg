import { describe, expect, it } from "vitest";
import { markdownToTiptap } from "../../scripts/seed/markdown";
import { storiesEn } from "../../scripts/seed/data/stories-en";
import { storiesEs } from "../../scripts/seed/data/stories-es";
import { authors, topicCatalog } from "../../scripts/seed/data/people";
import { slugify } from "@/lib/domain/slug";

describe("markdownToTiptap (seed subset)", () => {
  it("converts blocks and inline marks", () => {
    const doc = markdownToTiptap(`
## Título

Un párrafo con **negritas**, *cursivas* y [un enlace](https://fogata.org).

> Una cita
> en dos líneas.

- uno
- dos

1. primero
2. segundo

---
`);
    expect(doc.content?.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "blockquote",
      "bulletList",
      "orderedList",
      "horizontalRule",
    ]);
    const marks = doc.content?.[1]?.content?.flatMap((n) => n.marks?.map((m) => m.type) ?? []);
    expect(marks).toEqual(["bold", "italic", "link"]);
    expect(doc.content?.[2]?.content?.[0]?.content?.[0]?.text).toBe("Una cita en dos líneas.");
  });
});

describe("seed data", () => {
  const all = [...storiesEs, ...storiesEn];

  it("has 20 stories split evenly between Spanish and English", () => {
    expect(storiesEs).toHaveLength(10);
    expect(storiesEn).toHaveLength(10);
  });

  it("references known authors and topics, with at most 5 topics each", () => {
    const usernames = new Set(authors.map((a) => a.username));
    const topics = new Set(topicCatalog.map((t) => t.slug));
    for (const story of all) {
      expect(usernames.has(story.author), story.title).toBe(true);
      expect(story.topics.length).toBeLessThanOrEqual(5);
      for (const topic of story.topics) expect(topics.has(topic), `${story.title}: ${topic}`).toBe(true);
    }
  });

  it("gives every story a unique slug per author", () => {
    const keys = all.map((s) => `${s.author}/${slugify(s.title)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only uses reserved .test email addresses", () => {
    for (const author of authors) expect(author.email.endsWith("@fogata.test")).toBe(true);
  });

  it("gives every block a stable, UUID-shaped id when seeded", () => {
    const a = markdownToTiptap("Uno\n\nDos", "lucia/el-mole");
    const b = markdownToTiptap("Uno\n\nDos", "lucia/el-mole");
    const ids = a.content?.map((n) => n.attrs?.id);
    expect(ids).toEqual(b.content?.map((n) => n.attrs?.id));
    expect(new Set(ids).size).toBe(2);
    for (const id of ids ?? []) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
