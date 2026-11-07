/**
 * Reader display preferences (text size, typeface, line width). Stored per
 * device in localStorage and applied as data attributes on <html> before the
 * first paint, so a saved preference never causes a layout jump.
 */

export const READER_SIZES = ["s", "m", "l", "xl"] as const;
/** "readable": Atkinson Hyperlegible Next with extra spacing (dyslexia-friendly). */
export const READER_FONTS = ["serif", "sans", "readable"] as const;
export const READER_WIDTHS = ["narrow", "standard", "wide"] as const;

export type ReaderPrefs = {
  size: (typeof READER_SIZES)[number];
  font: (typeof READER_FONTS)[number];
  width: (typeof READER_WIDTHS)[number];
};

export const DEFAULT_READER_PREFS: ReaderPrefs = { size: "m", font: "serif", width: "standard" };
export const READER_PREFS_KEY = "fogata:reader";

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseReaderPrefs(raw: unknown): ReaderPrefs {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    size: pick(READER_SIZES, obj.size, DEFAULT_READER_PREFS.size),
    font: pick(READER_FONTS, obj.font, DEFAULT_READER_PREFS.font),
    width: pick(READER_WIDTHS, obj.width, DEFAULT_READER_PREFS.width),
  };
}

/** Data attributes for <html>; defaults are left off so CSS falls back to the base tokens. */
export function readerPrefsAttributes(prefs: ReaderPrefs): Record<"readerSize" | "readerFont" | "readerWidth", string | undefined> {
  return {
    readerSize: prefs.size === DEFAULT_READER_PREFS.size ? undefined : prefs.size,
    readerFont: prefs.font === DEFAULT_READER_PREFS.font ? undefined : prefs.font,
    readerWidth: prefs.width === DEFAULT_READER_PREFS.width ? undefined : prefs.width,
  };
}

/**
 * Inline script run before paint. Kept tiny and self-contained (no imports)
 * because it's serialized into the page as text.
 */
export const READER_PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  READER_PREFS_KEY,
)})||"{}");var d=document.documentElement.dataset;if(["s","l","xl"].indexOf(p.size)>-1)d.readerSize=p.size;if(p.font==="sans"||p.font==="readable")d.readerFont=p.font;if(["narrow","wide"].indexOf(p.width)>-1)d.readerWidth=p.width;}catch(e){}})();`;
