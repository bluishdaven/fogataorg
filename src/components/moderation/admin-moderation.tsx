import { getViewer } from "@/lib/auth";
import type { ModerationStatus } from "@/lib/domain/moderation";
import { ModerationPanel } from "./moderation-panel";

/** Moderation controls on a story, for admins only (streams in; never part of the cached page). */
export async function AdminModeration({
  storyId,
  status,
  reason,
}: {
  storyId: string;
  status: ModerationStatus | null;
  reason: string | null;
}) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;
  return <ModerationPanel storyId={storyId} status={status} reason={reason} />;
}
