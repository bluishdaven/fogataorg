import { getLocale } from "next-intl/server";
import { getViewer } from "@/lib/auth";
import { listResponses } from "@/lib/data/social";
import type { TiptapDoc } from "@/lib/domain/content";
import { storyPath } from "@/lib/domain/handle-routes";
import { blockTexts } from "@/lib/domain/social";
import { ParagraphAnchors } from "./paragraph-anchors";
import { ResponsesSection } from "./responses-section";

/** Responses for a story, loaded per reader inside <Suspense>. */
export async function StoryResponses({
  storyId,
  storyAuthorId,
  authorUsername,
  slug,
  content,
}: {
  storyId: string;
  storyAuthorId: string;
  authorUsername: string;
  slug: string;
  content: TiptapDoc;
}) {
  const viewer = await getViewer();
  const [list, locale] = await Promise.all([listResponses(viewer, storyId), getLocale()]);
  const texts = blockTexts(content);
  const counts: Record<string, number> = {};
  for (const response of list) {
    if (response.blockId && texts[response.blockId]) counts[response.blockId] = (counts[response.blockId] ?? 0) + 1;
  }

  return (
    <>
      <ParagraphAnchors counts={counts} />
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
