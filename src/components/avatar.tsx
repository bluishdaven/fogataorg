import { initials, isAvatarUrl } from "@/lib/domain/avatars";
import { cn } from "@/lib/utils";

// Inlined at build time. Read directly (not via lib/env) so the component also renders where the
// env isn't configured, e.g. unit tests; without it no photo passes the check and initials show.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * A person's profile photo, or their initials on the ember tint when they have
 * none. Only photos from our own avatars bucket are ever shown. Decorative by
 * default because a name is almost always next to it; pass `labelled` when the
 * avatar stands alone. Size it with `className` (e.g. "size-10 text-sm").
 */
export function Avatar({
  name,
  url,
  className,
  labelled = false,
}: {
  name: string;
  url: string | null | undefined;
  className?: string;
  labelled?: boolean;
}) {
  const src = SUPABASE_URL && isAvatarUrl(url, SUPABASE_URL) ? url : null;
  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ember-soft text-xs font-semibold text-ember-text select-none",
        className,
      )}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? name : undefined}
      aria-hidden={labelled ? undefined : true}
      data-testid="avatar"
    >
      {src ? (
        // Our own small WebP files, served from Supabase Storage as they are (no Next image optimizer).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}
