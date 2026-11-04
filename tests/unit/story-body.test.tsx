// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoryBody, safeHref } from "@/components/story-body";
import type { TiptapDoc } from "@/lib/domain/content";

describe("safeHref", () => {
  it("allows http(s) and mailto only", () => {
    expect(safeHref("https://fogata.org/x")).toBe("https://fogata.org/x");
    expect(safeHref("mailto:hola@fogata.test")).toBe("mailto:hola@fogata.test");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(" JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref(42)).toBeNull();
  });
});

describe("StoryBody", () => {
  it("renders allowlisted nodes and marks", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hola " },
            { type: "text", text: "mundo", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: " y ", marks: [] },
            { type: "text", text: "enlace", marks: [{ type: "link", attrs: { href: "https://fogata.org" } }] },
          ],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Cita" }] }] },
        { type: "horizontalRule" },
      ],
    };
    const { container } = render(<StoryBody doc={doc} lang="es" />);
    expect(container.querySelector("h2")?.textContent).toBe("Título");
    expect(container.querySelector("em > strong, strong > em")?.textContent).toBe("mundo");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://fogata.org/");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(container.querySelector("blockquote")?.textContent).toBe("Cita");
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.firstElementChild?.getAttribute("lang")).toBe("es");
  });

  it("drops unknown nodes and unsafe links instead of rendering them", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "rawHtml", attrs: { html: "<script>alert(1)</script>" } },
        { type: "iframe", attrs: { src: "https://evil.example" } },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "<img src=x onerror=alert(1)>" },
            { type: "text", text: "clic", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          ],
        },
      ],
    } satisfies TiptapDoc;
    const { container } = render(<StoryBody doc={doc} lang="en" />);
    expect(container.querySelector("script, iframe, img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    // Text that looks like HTML is shown as text, never parsed.
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
