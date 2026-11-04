import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { StoryEditor } from "@/components/editor/story-editor";
import { getViewer } from "@/lib/auth";
import { getStoryForEditing, listTopics } from "@/lib/data/my-stories";
import { storyIdSchema } from "@/lib/domain/stories";

type Props = PageProps<"/[locale]/write/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Editor");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default function WritePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div aria-hidden className="mx-auto mt-20 flex max-w-[var(--measure)] flex-col gap-4 px-4">
          <div className="h-12 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
          <div className="mt-6 h-64 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <Writer params={params} />
    </Suspense>
  );
}

async function Writer({ params }: Pick<Props, "params">) {
  const { id, locale } = await params;
  if (!storyIdSchema.safeParse(id).success) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/write/${id}`)}`);
  const [story, topics] = await Promise.all([getStoryForEditing(viewer, id), listTopics()]);
  if (!story) notFound();
  return <StoryEditor story={story} userId={viewer.id} username={viewer.username} topics={topics} />;
}
