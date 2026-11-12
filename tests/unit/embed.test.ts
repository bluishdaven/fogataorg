import { describe, expect, it } from "vitest";
import { embedCode, embedCsp, embedHtml, embedPath, parseEmbedTheme, type EmbedCard } from "@/lib/domain/embed";

const card: EmbedCard = {
  lang: "es",
  title: `Humo <script>alert("x")</script>`,
  description: "Una tarde & su ceniza",
  author: "Ana",
  avatarUrl: null,
  meta: "4 min de lectura",
  url: "https://fogata.org/@ana/humo",
  cta: "Leer en Fogata",
  accent: "#c2410c",
  image: { url: "https://images.unsplash.com/photo-1?ixid=1&w=320", alt: "Humo", credit: { label: "Sol Rivera", authorUrl: "https://unsplash.com/@sol", siteUrl: "https://unsplash.com/" } },
  warning: null,
  theme: "auto",
};

describe("embed card", () => {
  it("escapes everything a writer typed and links out in a new tab", () => {
    const html = embedHtml(card);
    expect(html).not.toContain("<script>");
    expect(html).toContain("Humo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Una tarde &amp; su ceniza");
    expect(html).toContain('href="https://fogata.org/@ana/humo" target="_blank" rel="noopener"');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("--accent:#c2410c");
    expect(html).toContain("Sol Rivera</a> / <a");
  });

  it("drops a malformed accent, and hides text and picture behind a content warning", () => {
    const html = embedHtml({ ...card, accent: "red;background:url(x)", warning: "Advertencia", theme: "dark" });
    expect(html).not.toContain("style=\"--accent");
    expect(html).not.toContain("url(x)");
    expect(html).not.toContain("images.unsplash.com");
    expect(html).not.toContain("Una tarde");
    expect(html).toContain("Advertencia");
    expect(html).toContain('<html lang="es" class="dark">');
  });

  it("gives sites a lazy iframe snippet and a CSP that only allows framing", () => {
    expect(embedPath("ana", "humo")).toBe("/embed/ana/humo");
    const code = embedCode("https://fogata.org/embed/ana/humo", `Say "hi"`);
    expect(code).toContain('src="https://fogata.org/embed/ana/humo"');
    expect(code).toContain('title="Say &quot;hi&quot;"');
    expect(code).toContain('loading="lazy"');
    expect(embedCsp(["https://images.unsplash.com"])).toContain("frame-ancestors *");
    expect(embedCsp([])).toContain("default-src 'none'");
    expect(parseEmbedTheme("dark")).toBe("dark");
    expect(parseEmbedTheme("neon")).toBe("auto");
  });
});
