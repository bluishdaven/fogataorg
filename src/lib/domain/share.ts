/**
 * One-tap share links for desktop (phones use the native share sheet instead).
 * Each network gets the story's share URL (the unprefixed /@handle/slug form,
 * which picks the reader's language) and a short line of text.
 */

export const SHARE_NETWORKS = ["whatsapp", "x", "facebook", "linkedin", "threads", "telegram", "email"] as const;
export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

export function shareLink(network: ShareNetwork, url: string, text: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "x":
      return `https://x.com/intent/tweet?text=${t}&url=${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "threads":
      return `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "email":
      return `mailto:?subject=${t}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
  }
}
