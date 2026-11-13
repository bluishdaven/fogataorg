import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { pushConfig, sendPendingPushes, webPushSender } from "./send";

/**
 * Pushes whatever notifications just changed, once the action's response has gone out. Call it
 * from server actions after a write that can notify someone (the notification itself is written
 * by database triggers inside that write). Does nothing when push isn't configured.
 */
export function pushSoon(): void {
  const config = pushConfig();
  if (!config) return;
  after(async () => {
    try {
      const result = await sendPendingPushes({ db, send: webPushSender(config) });
      if (result.groups) console.info("[push]", result);
    } catch (error) {
      console.error("[push] run failed", error instanceof Error ? error.message : error);
    }
  });
}
