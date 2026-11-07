import { sql } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { asAnon } from "@/lib/db/rls";
import { clientIp } from "@/lib/domain/limits";
import { looksAutomated, readerHash } from "@/lib/domain/reads";
import { emailSigningSecret } from "@/lib/email/config";
import { savePosition } from "@/lib/data/reading";
import { storedProgress } from "@/lib/domain/reading-position";

const readSchema = z.object({
  storyId: z.uuid(),
  ratio: z.number().min(0).max(1),
  seconds: z.number().int().min(0).max(86_400),
  /** Where the reader is now (signed-in readers' place is saved for Continue reading). */
  position: z
    .object({ blockId: z.string().regex(/^[0-9a-f-]{36}$/).nullable(), progress: z.number().min(0).max(1) })
    .optional(),
});

const noContent = () => new Response(null, { status: 204 });

/**
 * Reading beacon from the story page (navigator.sendBeacon, text/plain JSON). Stores how far the
 * reader got under a daily HMAC of who they are (see read_events); always answers 204 so the
 * beacon never retries or reveals anything.
 */
export async function POST(request: NextRequest) {
  if (looksAutomated(request.headers.get("user-agent"))) return noContent();
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return noContent();
  }
  const parsed = readSchema.safeParse(body);
  if (!parsed.success) return noContent();

  const viewer = await getViewer();
  const identity = viewer ? `user:${viewer.id}` : clientIp(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
  if (!identity) return noContent();
  const day = new Date().toISOString().slice(0, 10);
  const hash = readerHash(emailSigningSecret() ?? "fogata-local-reads", day, identity);
  const { storyId, ratio, seconds, position } = parsed.data;
  await asAnon((tx) =>
    tx.execute(sql`select public.record_read(${storyId}::uuid, ${hash}, ${ratio}::real, ${seconds}::integer, ${viewer?.id ?? null}::uuid)`),
  );
  if (viewer && position) {
    await savePosition(viewer, storyId, { blockId: position.blockId, progress: storedProgress(position.progress, ratio) }).catch(() => undefined);
  }
  return noContent();
}
