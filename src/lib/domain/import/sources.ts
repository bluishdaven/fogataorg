import { csvRecords } from "./csv";
import { ImportFileError, isZip, readZip, type ZipEntry } from "./zip";

/**
 * Reads an export file (Medium zip, Substack zip, WordPress WXR, or one HTML file) into posts with
 * their HTML. Runs in the browser; `parser` is the page's DOMParser.
 */

export type ImportSource = "medium" | "substack" | "wordpress" | "html";
export type ImportedPost = {
  key: string;
  title: string;
  subtitle: string;
  /** Body HTML. */
  html: string;
  /** The post's address on the old site, when the export says. */
  sourceUrl: string | null;
  /** ISO date, when known. */
  date: string | null;
  draft: boolean;
};

export const MAX_POSTS = 200;
const text = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const decode = (bytes: Uint8Array) => new TextDecoder("utf-8").decode(bytes);
const isoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value.includes(" ") && !value.includes("T") && /^\d{4}-/.test(value) ? `${value.replace(" ", "T")}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const httpUrl = (value: string | null | undefined) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Classic WordPress posts often have no <p>: blank lines separate paragraphs. */
export function autoParagraphs(html: string): string {
  if (/<(p|div|h[1-6]|ul|ol|blockquote|figure|pre|table)\b/i.test(html)) return html;
  return html
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function parseWordPress(xml: string, parser: DOMParser): ImportedPost[] {
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new ImportFileError("unknownFormat");
  const field = (item: Element, name: string) => item.getElementsByTagName(name)[0]?.textContent ?? "";
  return Array.from(doc.getElementsByTagName("item")).flatMap((item, index) => {
    if (field(item, "wp:post_type") !== "post") return [];
    const status = field(item, "wp:status");
    if (!["publish", "draft", "private", "pending", "future"].includes(status)) return [];
    const html = autoParagraphs(field(item, "content:encoded"));
    const excerpt = text(parser.parseFromString(field(item, "excerpt:encoded"), "text/html").body.textContent);
    return [
      {
        key: `wp-${field(item, "wp:post_id") || index}`,
        title: text(field(item, "title")),
        subtitle: excerpt.slice(0, 280),
        html,
        sourceUrl: status === "publish" ? httpUrl(field(item, "link")) : null,
        date: isoDate(field(item, "wp:post_date_gmt")) ?? isoDate(field(item, "pubDate")),
        draft: status !== "publish",
      },
    ];
  });
}

function parseMediumPost(name: string, html: string, parser: DOMParser): ImportedPost | null {
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.querySelector('section[data-field="body"]');
  if (!body) return null;
  return {
    key: `medium-${name}`,
    title: text(doc.querySelector("h1.p-name")?.textContent ?? doc.title),
    subtitle: text(doc.querySelector('section[data-field="subtitle"]')?.textContent).slice(0, 280),
    html: body.innerHTML,
    sourceUrl: httpUrl(doc.querySelector("a.p-canonical")?.getAttribute("href")),
    date: isoDate(doc.querySelector("time.dt-published")?.getAttribute("datetime")),
    draft: /(^|\/)draft_/.test(name),
  };
}

async function parseZip(entries: ZipEntry[], parser: DOMParser): Promise<{ source: ImportSource; posts: ImportedPost[] }> {
  const byName = new Map(entries.map((entry) => [entry.name.replace(/^[^/]+\/(?=posts)/, ""), entry]));
  const csv = [...byName.entries()].find(([name]) => /(^|\/)posts\.csv$/.test(name))?.[1];
  if (csv) {
    // Substack: posts.csv describes posts/<post_id>.html.
    const posts: ImportedPost[] = [];
    for (const row of csvRecords(decode(await csv.read()))) {
      const id = row.post_id ?? "";
      const file = [...byName.entries()].find(([name]) => name.endsWith(`posts/${id}.html`))?.[1];
      if (!id || !file) continue;
      posts.push({
        key: `substack-${id}`,
        title: text(row.title),
        subtitle: text(row.subtitle).slice(0, 280),
        html: decode(await file.read()),
        sourceUrl: null,
        date: isoDate(row.post_date),
        draft: row.is_published !== "true",
      });
      if (posts.length >= MAX_POSTS) break;
    }
    return { source: "substack", posts };
  }
  const posts: ImportedPost[] = [];
  for (const [name, entry] of byName) {
    if (!/(^|\/)posts\/[^/]+\.html$/.test(name)) continue;
    const post = parseMediumPost(name.split("/").pop()!, decode(await entry.read()), parser);
    if (post) posts.push(post);
    if (posts.length >= MAX_POSTS) break;
  }
  if (!posts.length) throw new ImportFileError("unknownFormat");
  return { source: "medium", posts };
}

export async function readExport(file: { name: string; bytes: Uint8Array }, parser: DOMParser): Promise<{ source: ImportSource; posts: ImportedPost[] }> {
  if (!file.bytes.length) throw new ImportFileError("empty");
  if (isZip(file.bytes)) return parseZip(readZip(file.bytes), parser);
  const content = decode(file.bytes);
  if (/<rss[\s>]/i.test(content.slice(0, 2_000)) || /\.xml$/i.test(file.name)) {
    return { source: "wordpress", posts: parseWordPress(content, parser).slice(0, MAX_POSTS) };
  }
  if (/<html|<body|<article|<p[\s>]/i.test(content)) {
    const medium = parseMediumPost(file.name, content, parser);
    if (medium) return { source: "medium", posts: [medium] };
    const doc = parser.parseFromString(content, "text/html");
    const article = doc.querySelector("article") ?? doc.body;
    const heading = article.querySelector("h1");
    return {
      source: "html",
      posts: [{ key: `html-${file.name}`, title: text(heading?.textContent ?? doc.title), subtitle: "", html: article.innerHTML, sourceUrl: null, date: null, draft: false }],
    };
  }
  throw new ImportFileError("unknownFormat");
}
