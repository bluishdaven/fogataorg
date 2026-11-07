import type { HandleRoute } from "./handle-routes";

/** What a share URL (/@handle or /@handle/slug) points at for an anonymous visitor. */
export type HandleStatus = { kind: "found" } | { kind: "moved"; to: HandleRoute } | { kind: "missing" };

export type HandleStatusRow = {
  /** The current username matching the handle, if any. */
  username: string | null;
  /** The current username of whoever used this handle before, if any. */
  moved_to: string | null;
  /** Whether the story is visible (null when there's no slug). */
  story: boolean | null;
  /** Whether the series exists (null when it isn't a series address). */
  series?: boolean | null;
};

export function handleStatusFromRow(row: HandleStatusRow | null, route: HandleRoute): HandleStatus {
  if (row?.username) {
    if (route.slug && !row.story) return { kind: "missing" };
    if (route.series && !row.series) return { kind: "missing" };
    return { kind: "found" };
  }
  // Old usernames move to the new one; the story check happens again on the new URL.
  if (row?.moved_to) return { kind: "moved", to: { ...route, handle: row.moved_to } };
  return { kind: "missing" };
}

/**
 * Only page loads get the check: crawlers, link previews and people opening a link (browsers send
 * Sec-Fetch-Dest: document; bots send none). The app's own fetches (client navigations and
 * prefetches, "empty") skip it and fall back to the page's not-found view, so a list of story
 * cards doesn't cost a query per prefetched link.
 */
export function wantsHandleCheck(secFetchDest: string | null): boolean {
  return secFetchDest !== "empty";
}
