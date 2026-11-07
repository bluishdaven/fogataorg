import { getLocale } from "next-intl/server";
import { getViewer } from "@/lib/auth";
import { listStoryHighlights } from "@/lib/data/highlights";
import { listResponses } from "@/lib/data/social";
import type { TiptapDoc } from "@/lib/domain/content";
import { storyPath } from "@/lib/domain/handle-routes";
import { blockTexts } from "@/lib/domain/social";
import { publicEnv } from "@/lib/env";
import { ParagraphAnchors } from "./paragraph-anchors";
import { ResponsesSection } from "./responses-section";
import { SelectionToolbar } from "./selection-toolbar";

/** Responses, the reader's embers and the selection toolbar, loaded per reader inside <Suspense>. */
export async function StoryResponses({
  storyId,
  storyAuthorId,
  authorUsername,
  slug,
  content,
  title,
  authorName,
  language,
}: {
  storyId: string;
  storyAuthorId: string;
  authorUsername: string;
  slug: string;
  content: TiptapDoc;
  title: string;
  authorName: string;
  language: "en" | "es";
}) {
  const viewer = await getViewer();
  const [list, highlights, locale] = await Promise.all([listResponses(viewer, storyId), listStoryHighlights(viewer, storyId), getLocale()]);
  const storyUrl = new URL(storyPath(authorUsername, slug), publicEnv.NEXT_PUBLIC_SITE_URL).toString();
  const texts = blockTexts(content);
  const counts: Record<string, number> = {};
  for (const response of list) {
    if (response.blockId && texts[response.blockId]) counts[response.blockId] = (counts[response.blockId] ?? 0) + 1;
  }

  return (
    <>
      <ParagraphAnchors counts={counts} />
      <SelectionToolbar
        storyId={storyId}
        signedIn={Boolean(viewer)}
        loginHref={`/${locale}/login?next=${encodeURIComponent(storyPath(authorUsername, slug))}`}
        initialHighlights={highlights}
        share={{ url: storyUrl, slug, title, author: authorName, lang: language }}
      />
      <ResponsesSection
        storyId={storyId}
        storyAuthorId={storyAuthorId}
        initialResponses={list}
        blockTexts={texts}
        viewer={viewer ? { id: viewer.id, username: viewer.username, displayName: viewer.displayName } : null}
        loginHref={`/${locale}/login?next=${encodeURIComponent(`${storyPath(authorUsername, slug)}#responses`)}`}
      />
    </>
  );
}
