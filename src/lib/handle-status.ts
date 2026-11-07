import "server-only";
import { sql } from "drizzle-orm";
import { asAnon } from "@/lib/db/rls";
import type { HandleRoute } from "@/lib/domain/handle-routes";
import { handleStatusFromRow, type HandleStatus, type HandleStatusRow } from "@/lib/domain/handle-status";

/**
 * Whether /@handle[/slug] exists for an anonymous visitor (the same check the story and profile
 * pages make), or which username it moved to. The proxy calls this before the page streams, so a
 * miss can answer with a real 404 instead of a not-found page sent with 200. One indexed query,
 * on page loads only; nothing is remembered, so renames and new stories apply at once.
 */
export async function handleStatus(route: HandleRoute): Promise<HandleStatus> {
  const slug = route.slug ?? null;
  const [row] = await asAnon((tx) =>
    tx.execute<HandleStatusRow>(sql`
      select
        (select p.username from public.profiles p where lower(p.username) = lower(${route.handle})) as username,
        (select p.username from public.previous_usernames pu join public.profiles p on p.id = pu.profile_id
          where pu.username = lower(${route.handle})) as moved_to,
        case when ${slug}::text is null then null else exists (
          select 1 from public.stories s join public.profiles p on p.id = s.author_id
          where lower(p.username) = lower(${route.handle}) and s.slug = ${slug}::text
        ) end as story
    `),
  );
  return handleStatusFromRow(row ?? null, route);
}
