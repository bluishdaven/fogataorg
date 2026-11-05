import { describe, expect, it } from "vitest";
import { figuresOf, headingsOf, safeHref, sanitizeStoryDoc, StoryDocError, STORY_DOC_LIMITS } from "@/lib/domain/story-doc";

const PREFIXES = ["https://images.unsplash.com/", "http://127.0.0.1:54321/storage/v1/object/public/story-images/"];
const ID = "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f";
const UPLOAD = "http://127.0.0.1:54321/storage/v1/object/public/story-images/user-1/photo.webp";
const credit = {
  source: "unsplash",
  photoId: "Fg4tA0campfire",
  authorName: "Ana Ruiz",
  authorUrl: "https://unsplash.com/@anaruiz_photo",
  photoUrl: "https://unsplash.com/photos/x-Fg4tA0campfire",
};

const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("sanitizeStoryDoc", () => {
  it("keeps allowed blocks, marks and stable block ids", () => {
    const result = sanitizeStoryDoc(
      doc(
        { type: "heading", attrs: { level: 3, id: ID }, content: [{ type: "text", text: "Título" }] },
        {
          type: "paragraph",
          attrs: { id: ID },
          content: [
            { type: "text", text: "Hola", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://fogata.org" } }] },
          ],
        },
        { type: "pullQuote", content: [{ type: "text", text: "Frase" }] },
        { type: "callout", content: [{ type: "text", text: "Nota" }] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }] }] },
        { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const a = 1;" }] },
        { type: "horizontalRule" },
      ),
      PREFIXES,
    );
    expect(result.content?.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "pullQuote",
      "callout",
      "orderedList",
      "codeBlock",
      "horizontalRule",
    ]);
    expect(result.content?.[0]?.attrs).toEqual({ id: ID, level: 3 });
    expect(result.content?.[1]?.content?.[0]?.marks).toEqual([
      { type: "bold" },
      { type: "link", attrs: { href: "https://fogata.org/" } },
    ]);
    expect(result.content?.[4]?.attrs).toEqual({ start: 3 });
    expect(result.content?.[5]?.attrs).toEqual({ language: "ts" });
  });

  it("drops unknown nodes, unknown attributes and unsafe links", () => {
    const result = sanitizeStoryDoc(
      doc(
        { type: "rawHtml", attrs: { html: "<script>alert(1)</script>" } },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        {
          type: "paragraph",
          attrs: { id: "not-a-uuid", onclick: "alert(1)", style: "color:red" },
          content: [
            { type: "text", text: "clic", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "highlight" }] },
            { type: "mention", attrs: { id: "x" } },
          ],
        },
      ),
      PREFIXES,
    );
    expect(result).toEqual({ type: "doc", content: [{ type: "paragraph", attrs: {}, content: [{ type: "text", text: "clic" }] }] });
  });

  it("keeps figures from allowed hosts, with bounded alt text and a valid credit", () => {
    const result = sanitizeStoryDoc(
      doc(
        {
          type: "figure",
          attrs: { id: ID, src: UPLOAD, alt: `  ${"a".repeat(400)}`, caption: "Pie", layout: "wide", width: 1200, height: 800, credit, extra: "x" },
        },
        { type: "figure", attrs: { src: "https://images.unsplash.com/photo-1?ixid=1", alt: "Fogata", credit: { ...credit, authorUrl: "https://evil.example" } } },
      ),
      PREFIXES,
    );
    const [first, second] = figuresOf(result);
    expect(first).toMatchObject({ id: ID, src: UPLOAD, caption: "Pie", layout: "wide", width: 1200, height: 800, credit });
    expect(first?.alt).toHaveLength(300);
    expect(second).toMatchObject({ layout: "inset", credit: null, width: null });
  });

  it("rejects images from any other host", () => {
    for (const src of ["https://evil.example/photo.jpg", "javascript:alert(1)", "https://images.unsplash.com.evil.example/x", "http://images.unsplash.com/x"]) {
      expect(() => sanitizeStoryDoc(doc({ type: "figure", attrs: { src, alt: "x" } }), PREFIXES)).toThrow(StoryDocError);
    }
  });

  it("rejects documents that are too large or too deep, or aren't documents", () => {
    const huge = doc(...Array.from({ length: 2000 }, () => ({ type: "paragraph", content: [{ type: "text", text: "x".repeat(300) }] })));
    expect(() => sanitizeStoryDoc(huge, PREFIXES)).toThrow(expect.objectContaining({ reason: "too_large" }));

    let nested: unknown = { type: "paragraph", content: [{ type: "text", text: "deep" }] };
    for (let i = 0; i < STORY_DOC_LIMITS.maxDepth + 2; i += 1) {
      nested = { type: "bulletList", content: [{ type: "listItem", content: [nested] }] };
    }
    expect(() => sanitizeStoryDoc(doc(nested), PREFIXES)).toThrow(expect.objectContaining({ reason: "too_deep" }));

    expect(() => sanitizeStoryDoc({ type: "paragraph" }, PREFIXES)).toThrow(expect.objectContaining({ reason: "invalid" }));
    expect(() => sanitizeStoryDoc("nope", PREFIXES)).toThrow(StoryDocError);
  });

  it("always returns at least one paragraph", () => {
    expect(sanitizeStoryDoc(doc(), PREFIXES)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("helpers", () => {
  it("lists headings for a table of contents", () => {
    expect(
      headingsOf({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2, id: ID }, content: [{ type: "text", text: "Uno" }] },
          { type: "paragraph" },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Dos" }] },
        ],
      }),
    ).toEqual([
      { id: ID, level: 2, text: "Uno" },
      { id: undefined, level: 3, text: "Dos" },
    ]);
  });

  it("allows only http(s) and mailto links", () => {
    expect(safeHref("https://fogata.org/a")).toBe("https://fogata.org/a");
    expect(safeHref("mailto:hola@fogata.test")).toBe("mailto:hola@fogata.test");
    expect(safeHref("data:text/html,x")).toBeNull();
  });
});
