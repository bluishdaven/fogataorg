import { xmlEscape } from "./rss";

/**
 * "Read on Fogata": a small card writers (or anyone) can put on their own site with an iframe. It
 * is a standalone HTML page with inline styles and no scripts, served from /embed/<handle>/<slug>.
 * Every value is escaped; the card links to the story in a new tab.
 */

export const EMBED_HEIGHT = 200;
export const EMBED_MAX_WIDTH = 640;

export type EmbedTheme = "auto" | "light" | "dark";

export type EmbedCard = {
  lang: string;
  title: string;
  description: string;
  author: string;
  avatarUrl: string | null;
  meta: string;
  url: string;
  cta: string;
  accent: string | null;
  image: { url: string; alt: string; credit: { label: string; authorUrl: string; siteUrl: string } | null } | null;
  /** NSFW stories show this instead of their text and picture. */
  warning: string | null;
  theme: EmbedTheme;
};

export function parseEmbedTheme(value: string | null): EmbedTheme {
  return value === "light" || value === "dark" ? value : "auto";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const FLAME = `<svg class="flame" viewBox="0 0 32 40" width="14" height="18" aria-hidden="true"><g class="outer"><path d="M16 1c1.2 6.4 6.6 9.6 9.8 15.2 3.6 6.4 2.3 14.4-3.2 18.6A11.5 11.5 0 0 1 4.3 30C1.8 23.8 4.6 18.4 8 15.2c.4 3 1.9 5 4.2 6C10.6 14.4 12.8 6.6 16 1Z" fill="var(--ember)"/><path class="inner" d="M16.5 17c.6 3.6 3.9 5.4 4.6 9a6.3 6.3 0 0 1-12.2 3.2c-.7-2.9.6-5.3 2.4-6.8.3 1.6 1.1 2.6 2.4 3.1-.6-3.4.8-6.4 2.8-8.5Z" fill="#ffd27a"/></g></svg>`;

const LIGHT = "--bg:#fffdf8;--fg:#1d1a16;--muted:#6b5f50;--border:#e6dccb;--ember:#e8590c;--ember-text:#b13a0a;--soft:#fde4d0;color-scheme:light";
const DARK = "--bg:#121621;--fg:#ece6da;--muted:#a3a9b6;--border:#232b3c;--ember:#ff7a2f;--ember-text:#ff9a5c;--soft:#33200f;color-scheme:dark";

const STYLES = `
:root{${LIGHT}}
@media (prefers-color-scheme:dark){:root:not(.light){${DARK}}}
:root.dark{${DARK}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:transparent}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased}
.card{position:relative;display:flex;gap:16px;height:100%;padding:16px 18px;border:1px solid var(--border);border-radius:16px;background:var(--bg);overflow:hidden;transition:border-color .2s}
.card:hover{border-color:var(--ember)}
.card:has(.main:focus-visible){outline:2px solid var(--ember);outline-offset:-2px}
.accent{position:absolute;inset:0 auto 0 0;width:4px;background:var(--accent)}
.text{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.by{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.by img,.initial{width:22px;height:22px;border-radius:50%;object-fit:cover;flex:none}
.initial{display:inline-flex;align-items:center;justify-content:center;background:var(--soft);color:var(--ember-text);font-size:11px;font-weight:600}
.main{color:inherit;text-decoration:none;outline:none}
.main::after{content:"";position:absolute;inset:0}
h1{font-family:"Source Serif 4",Georgia,"Times New Roman",serif;font-size:20px;line-height:1.25;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card:hover h1{color:var(--ember-text)}
.ex{font-family:Georgia,"Times New Roman",serif;font-size:15px;line-height:1.45;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.cta{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--ember-text)}
.credit{position:relative;z-index:1;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.credit a{color:inherit}
.pic{flex:0 0 132px;border-radius:10px;overflow:hidden;background:var(--soft)}
.pic img{display:block;width:100%;height:100%;object-fit:cover}
@media (max-width:440px){.pic{display:none}}
.flame g,.flame .inner{transform-origin:bottom;transform-box:fill-box}
@media (prefers-reduced-motion:no-preference){.flame .outer{animation:flicker 2.8s ease-in-out infinite}.flame .inner{animation:flicker-inner 1.9s ease-in-out infinite}.card:hover .flame .outer{animation-duration:1.4s}}
@keyframes flicker{0%,100%{transform:scale(1,1) skewX(0)}25%{transform:scale(.97,1.04) skewX(-1.5deg)}50%{transform:scale(1.02,.97) skewX(1deg)}75%{transform:scale(.98,1.03) skewX(-.5deg)}}
@keyframes flicker-inner{0%,100%{transform:scale(1,1);opacity:.95}40%{transform:scale(.92,1.08);opacity:.8}70%{transform:scale(1.05,.95);opacity:1}}
`.trim();

export function embedHtml(card: EmbedCard): string {
  const e = xmlEscape;
  const accent = card.accent && HEX.test(card.accent) ? card.accent : null;
  const themeClass = card.theme === "auto" ? "" : ` class="${card.theme}"`;
  const avatar = card.avatarUrl
    ? `<img src="${e(card.avatarUrl)}" alt="">`
    : `<span class="initial" aria-hidden="true">${e(card.author.trim().charAt(0).toUpperCase() || "F")}</span>`;
  const image = card.image && !card.warning ? card.image : null;
  const credit = image?.credit
    ? `<p class="credit"><a href="${e(image.credit.authorUrl)}" target="_blank" rel="noopener noreferrer">${e(image.credit.label)}</a> / <a href="${e(image.credit.siteUrl)}" target="_blank" rel="noopener noreferrer">Unsplash</a></p>`
    : "";
  return [
    "<!doctype html>",
    `<html lang="${e(card.lang)}"${themeClass}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${e(card.title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    "<body>",
    `<article class="card"${accent ? ` style="--accent:${accent}"` : ""}>`,
    accent ? '<span class="accent" aria-hidden="true"></span>' : "",
    '<div class="text">',
    `<p class="by">${avatar}<span>${e(card.author)} · ${e(card.meta)}</span></p>`,
    `<h1><a class="main" href="${e(card.url)}" target="_blank" rel="noopener">${e(card.title)}</a></h1>`,
    card.warning ? `<p class="ex">${e(card.warning)}</p>` : card.description ? `<p class="ex">${e(card.description)}</p>` : "",
    `<div class="foot"><span class="cta">${FLAME}${e(card.cta)}</span>${credit}</div>`,
    "</div>",
    image ? `<div class="pic"><img src="${e(image.url)}" alt="${e(image.alt)}" loading="lazy"></div>` : "",
    "</article>",
    "</body>",
    "</html>",
  ].join("");
}

/** The snippet to paste into a site: a lazy, borderless iframe at the card's height. */
export function embedCode(embedUrl: string, title: string): string {
  return `<iframe src="${xmlEscape(embedUrl)}" title="${xmlEscape(title)}" width="100%" height="${EMBED_HEIGHT}" style="border:0;max-width:${EMBED_MAX_WIDTH}px;border-radius:16px" loading="lazy"></iframe>`;
}

/** /embed/<handle>/<slug> on the site. */
export function embedPath(handle: string, slug: string): string {
  return `/embed/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`;
}

/** The Content-Security-Policy for embed pages: no scripts, framable anywhere, pictures from our hosts. */
export function embedCsp(imageOrigins: readonly string[]): string {
  return [
    "default-src 'none'",
    `img-src data: ${imageOrigins.join(" ")}`,
    "style-src 'unsafe-inline'",
    "frame-ancestors *",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
