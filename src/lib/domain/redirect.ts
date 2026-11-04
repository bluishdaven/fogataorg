/**
 * Validates a post-login "next" path so auth flows can't be turned into open
 * redirects. Only same-origin absolute paths are allowed.
 */
export function safeNextPath(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  // Protocol-relative (//evil.com) and backslash tricks (/\evil.com) resolve off-site.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Control characters (including tabs/newlines browsers strip) are never valid here.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://fogata.local");
    if (url.origin !== "http://fogata.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
