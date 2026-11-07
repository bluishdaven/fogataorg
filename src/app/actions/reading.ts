"use server";

import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { getPosition } from "@/lib/data/reading";
import type { ReadingPosition } from "@/lib/domain/reading-position";

/** The signed-in reader's place in a story, for "Pick up where you left off". */
export async function getReadingPosition(storyId: unknown): Promise<ReadingPosition | null> {
  const viewer = await getViewer();
  if (!viewer || !z.uuid().safeParse(storyId).success) return null;
  return getPosition(viewer, storyId as string);
}
