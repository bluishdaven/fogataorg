/** Where a reader stopped: the paragraph at the top of their screen and how far through they were. */
export type ReadingPosition = { blockId: string | null; progress: number };

/** "Pick up where you left off" only between the first few lines and the very end. */
export function worthResuming(position: ReadingPosition | null | undefined): position is ReadingPosition & { blockId: string } {
  return Boolean(position?.blockId) && position!.progress >= 0.05 && position!.progress < 0.95;
}

/** Stored progress: reaching the end counts as finished (1), so it drops out of Continue reading. */
export function storedProgress(current: number, furthest: number): number {
  if (furthest >= 0.95) return 1;
  return Math.round(Math.min(1, Math.max(0, current)) * 100) / 100;
}

export const LOCAL_POSITIONS_KEY = "fogata:positions";
const MAX_LOCAL = 50;

/** Visitors' positions live in their browser: a small map of story id → position, newest kept. */
export function readLocalPositions(raw: string | null): Record<string, ReadingPosition & { at: number }> {
  try {
    const value = JSON.parse(raw ?? "{}") as unknown;
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(([, entry]) => {
        const e = entry as Partial<ReadingPosition & { at: number }>;
        return typeof e?.progress === "number" && typeof e.at === "number" && (e.blockId === null || typeof e.blockId === "string");
      }),
    ) as Record<string, ReadingPosition & { at: number }>;
  } catch {
    return {};
  }
}

export function withLocalPosition(all: Record<string, ReadingPosition & { at: number }>, storyId: string, position: ReadingPosition, at: number) {
  const next = { ...all, [storyId]: { ...position, at } };
  const newest = Object.entries(next).sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_LOCAL);
  return Object.fromEntries(newest);
}
