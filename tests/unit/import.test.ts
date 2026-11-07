// @vitest-environment jsdom
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { tiptapToText, type TiptapNode } from "@/lib/domain/content";
import { parseCsv } from "@/lib/domain/import/csv";
import { htmlToDoc } from "@/lib/domain/import/html-to-doc";
import { guessLanguage } from "@/lib/domain/import/language";
import { isPublicAddress } from "@/lib/domain/import/network";
import { autoParagraphs, readExport } from "@/lib/domain/import/sources";
import { readZip } from "@/lib/domain/import/zip";
import { sanitizeStoryDoc } from "@/lib/domain/story-doc";

/** A real zip (deflated entries, central directory) built in memory. */
function zip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const packed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, centralBytes, end]));
}

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
const types = (nodes: TiptapNode[] | undefined) => (nodes ?? []).map((node) => node.type);

const MEDIUM_POST = `<!DOCTYPE html><html><head><title>Río abajo</title></head><body><article class="h-entry">
<header><h1 class="p-name">Río abajo</h1></header>
<section data-field="subtitle" class="p-summary">Notas de un viaje lento</section>
<section data-field="body" class="e-content"><section class="section section--body section--first"><div class="section-divider"><hr class="section-divider"></div>
<div class="section-content"><div class="section-inner">
<h3 class="graf graf--h3 graf--title">Río abajo</h3>
<p class="graf graf--p">El agua <strong>no tiene</strong> prisa y <a href="https://example.com/rio">nosotros</a> tampoco.</p>
<figure class="graf graf--figure"><img class="graf-image" data-width="1600" data-height="900" src="https://cdn-images-1.medium.com/max/800/1*abc.jpeg"><figcaption class="imageCaption">La orilla</figcaption></figure>
<blockquote class="graf graf--pullquote">Todo río sabe adónde va.</blockquote>
<ul class="postList"><li class="graf graf--li">Pan</li><li class="graf graf--li">Café</li></ul>
<pre class="graf graf--pre">let rio = "lento";</pre>
</div></div></section></section>
<footer><p><a href="https://medium.com/@ana/rio-abajo-123" class="p-canonical">Canonical link</a></p><time class="dt-published" datetime="2021-03-04T10:00:00.000Z">March 4</time></footer>
</article></body></html>`;

describe("import: reading files", () => {
  it("reads zips with deflated entries", async () => {
    const entries = readZip(zip({ "posts/a.html": "<p>hola</p>", "README.txt": "x".repeat(500) }));
    expect(entries.map((entry) => entry.name)).toEqual(["posts/a.html", "README.txt"]);
    expect(new TextDecoder().decode(await entries[0]!.read())).toBe("<p>hola</p>");
  });

  it("parses CSV with quotes, commas and newlines in fields", () => {
    expect(parseCsv('post_id,title\n1.a,"Hola, mundo"\n2.b,"Dice ""sí""\nde nuevo"\n')).toEqual([
      ["post_id", "title"],
      ["1.a", "Hola, mundo"],
      ["2.b", 'Dice "sí"\nde nuevo'],
    ]);
  });

  it("reads a Medium export, keeping drafts apart", async () => {
    const { source, posts } = await readExport(
      { name: "medium.zip", bytes: zip({ "medium-export/posts/2021-03-04_Rio-abajo-123.html": MEDIUM_POST, "medium-export/posts/draft_Otro-456.html": MEDIUM_POST.replace("Río abajo</h1>", "Otro</h1>") }) },
      new DOMParser(),
    );
    expect(source).toBe("medium");
    expect(posts.map((post) => [post.title, post.draft])).toEqual([["Río abajo", false], ["Otro", true]]);
    expect(posts[0]).toMatchObject({ subtitle: "Notas de un viaje lento", sourceUrl: "https://medium.com/@ana/rio-abajo-123", date: "2021-03-04T10:00:00.000Z" });
  });

  it("reads a Substack export from posts.csv", async () => {
    const { source, posts } = await readExport(
      {
        name: "substack.zip",
        bytes: zip({
          "posts.csv": "post_id,post_date,is_published,email_sent_at,type,audience,title,subtitle\n123.first-light,2024-01-02T03:04:05.000Z,true,,newsletter,everyone,First light,On mornings\n124.unsent,2024-02-02T03:04:05.000Z,false,,newsletter,everyone,Unsent,\n",
          "posts/123.first-light.html": "<p>The sun came up slowly.</p><p class=\"button-wrapper\"><a class=\"button\">Subscribe now</a></p>",
          "posts/124.unsent.html": "<p>Not yet.</p>",
        }),
      },
      new DOMParser(),
    );
    expect(source).toBe("substack");
    expect(posts.map((post) => [post.title, post.subtitle, post.draft])).toEqual([["First light", "On mornings", false], ["Unsent", "", true]]);
  });

  it("reads a WordPress export, with classic posts that have no <p>", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/"><channel>
      <item><title>Classic &amp; plain</title><link>https://blog.example/2019/classic/</link><content:encoded><![CDATA[First paragraph.

Second <em>one</em>.]]></content:encoded><excerpt:encoded><![CDATA[]]></excerpt:encoded><wp:post_id>7</wp:post_id><wp:post_date_gmt>2019-05-06 07:08:09</wp:post_date_gmt><wp:status>publish</wp:status><wp:post_type>post</wp:post_type></item>
      <item><title>About</title><content:encoded><![CDATA[<p>A page.</p>]]></content:encoded><wp:status>publish</wp:status><wp:post_type>page</wp:post_type></item>
      <item><title>Trashed</title><content:encoded><![CDATA[<p>x</p>]]></content:encoded><wp:status>trash</wp:status><wp:post_type>post</wp:post_type></item>
    </channel></rss>`;
    const { source, posts } = await readExport({ name: "blog.WordPress.xml", bytes: new TextEncoder().encode(xml) }, new DOMParser());
    expect(source).toBe("wordpress");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ title: "Classic & plain", sourceUrl: "https://blog.example/2019/classic/", date: "2019-05-06T07:08:09.000Z", draft: false });
    expect(posts[0]!.html).toBe("<p>First paragraph.</p>\n<p>Second <em>one</em>.</p>");
    expect(autoParagraphs("<p>Already</p>")).toBe("<p>Already</p>");
  });
});

describe("import: converting posts", () => {
  it("turns a Medium post into a clean story document with block ids", async () => {
    const { posts } = await readExport({ name: "post.html", bytes: new TextEncoder().encode(MEDIUM_POST) }, new DOMParser());
    const post = posts[0]!;
    const { doc, images } = htmlToDoc(parse(post.html), { newId, title: post.title, subtitle: post.subtitle });
    expect(types(doc.content)).toEqual(["paragraph", "figure", "pullQuote", "bulletList", "codeBlock"]);
    expect(images).toEqual(["https://cdn-images-1.medium.com/max/2000/1*abc.jpeg"]);
    expect(doc.content![0]!.content).toEqual([
      { type: "text", text: "El agua " },
      { type: "text", text: "no tiene", marks: [{ type: "bold" }] },
      { type: "text", text: " prisa y " },
      { type: "text", text: "nosotros", marks: [{ type: "link", attrs: { href: "https://example.com/rio" } }] },
      { type: "text", text: " tampoco." },
    ]);
    expect(doc.content![1]!.attrs).toMatchObject({ caption: "La orilla", width: 1600, height: 900 });
    expect(doc.content!.every((block) => typeof block.attrs?.id === "string")).toBe(true);
    // Once the picture is ours, the sanitizer accepts the whole thing unchanged.
    const ours = "https://x.supabase.co/storage/v1/object/public/story-images/u/p.webp";
    const rehosted = { ...doc, content: doc.content!.map((block) => (block.type === "figure" ? { ...block, attrs: { ...block.attrs, src: ours } } : block)) };
    const clean = sanitizeStoryDoc(rehosted, ["https://x.supabase.co/storage/v1/object/public/story-images/"]);
    expect(types(clean.content)).toEqual(types(rehosted.content));
    expect(clean.content!.map((block) => block.attrs?.id)).toEqual(rehosted.content!.map((block) => block.attrs?.id));
    expect(tiptapToText(clean)).toBe(tiptapToText(rehosted));
  });

  it("drops scripts and subscribe buttons, keeps embeds as links, flattens wrappers", () => {
    const { doc } = htmlToDoc(
      parse(`<div><div><p>One</p><script>alert(1)</script></div></div><p class="button-wrapper"><a href="/subscribe">Subscribe</a></p>
        <iframe src="https://www.youtube.com/embed/x"></iframe><h2>Part two</h2><blockquote><p>Said once.</p></blockquote><hr><table><tr><td>a</td><td>b</td></tr></table>`),
      { newId },
    );
    expect(types(doc.content)).toEqual(["paragraph", "paragraph", "heading", "blockquote", "horizontalRule", "paragraph"]);
    expect(tiptapToText(doc)).not.toContain("alert");
    expect(tiptapToText(doc)).not.toContain("Subscribe");
    expect(doc.content![1]!.content![0]).toEqual({ type: "text", text: "www.youtube.com", marks: [{ type: "link", attrs: { href: "https://www.youtube.com/embed/x" } }] });
  });

  it("guesses the language from common words", () => {
    expect(guessLanguage("El agua no tiene prisa y nosotros tampoco, porque el río sabe adónde va.")).toBe("es");
    expect(guessLanguage("The water is in no hurry and neither are we, because the river knows.")).toBe("en");
    expect(guessLanguage("Hola", "es")).toBe("es");
  });
});

describe("import: fetching pictures safely", () => {
  it("only allows public addresses", () => {
    for (const ip of ["8.8.8.8", "151.101.1.140", "2606:4700::6810:84e5", "::ffff:8.8.8.8"]) expect(isPublicAddress(ip)).toBe(true);
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1", "224.0.0.1"]) {
      expect(isPublicAddress(ip)).toBe(false);
    }
  });
});
