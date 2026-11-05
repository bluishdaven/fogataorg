// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoryBody, safeHref } from "@/components/story-body";
import type { TiptapDoc } from "@/lib/domain/content";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

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

const PREFIXES = ["https://images.unsplash.com/", "http://127.0.0.1:54321/storage/v1/object/public/story-images/"];

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

  it("renders figures from allowed hosts with caption and credit, and drops others", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "figure",
          attrs: {
            id: "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f",
            src: "http://127.0.0.1:54321/storage/v1/object/public/story-images/u/photo.webp",
            alt: "Una fogata",
            caption: "Medianoche",
            layout: "wide",
            width: 1200,
            height: 800,
            credit: {
              source: "unsplash",
              photoId: "Fg4tA0campfire",
              authorName: "Ana Ruiz",
              authorUrl: "https://unsplash.com/@anaruiz_photo",
              photoUrl: "https://unsplash.com/photos/x",
            },
          },
        },
        { type: "figure", attrs: { src: "https://evil.example/x.jpg", alt: "no" } },
        { type: "pullQuote", content: [{ type: "text", text: "Frase" }] },
        { type: "callout", content: [{ type: "text", text: "Nota" }] },
      ],
    };
    const { container } = render(
      <NextIntlClientProvider locale="es" messages={es} timeZone="UTC">
        <StoryBody doc={doc} lang="es" imagePrefixes={PREFIXES} />
      </NextIntlClientProvider>,
    );
    const figures = container.querySelectorAll("figure");
    expect(figures).toHaveLength(1);
    expect(figures[0]).toHaveClass("figure-wide");
    expect(figures[0]).toHaveAttribute("data-block", "0b9f6a52-8f0e-4c55-9d7a-2f4b1c3d5e6f");
    expect(container.querySelector("img")).toHaveAttribute("alt", "Una fogata");
    expect(container.querySelector("figcaption")?.textContent).toBe("MedianocheFoto de Ana Ruiz en Unsplash");
    expect(container.querySelector(".pull-quote")?.textContent).toBe("Frase");
    expect(container.querySelector("aside.callout")?.textContent).toBe("Nota");
  });

  it("renders no images when no hosts are allowed", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [{ type: "figure", attrs: { src: "https://images.unsplash.com/photo-1", alt: "x", width: 10, height: 10 } }],
    };
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <StoryBody doc={doc} lang="en" />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("img, figure")).toBeNull();
  });
});
