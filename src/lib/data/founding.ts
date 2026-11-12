import "server-only";
import { isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { asAnon } from "@/lib/db/rls";
import { profiles } from "@/lib/db/schema";
import { FOUNDING_WRITERS } from "@/lib/domain/badges";

/** How many founding writer places are still open (publishing refreshes it through "stories"). */
export async function getFoundingPlacesLeft(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag("stories");
  const [row] = await asAnon((tx) => tx.select({ taken: sql<number>`count(*)::int` }).from(profiles).where(isNotNull(profiles.foundingNumber)));
  return Math.max(0, FOUNDING_WRITERS - Number(row?.taken ?? 0));
}
