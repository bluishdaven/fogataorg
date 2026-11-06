import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";
import { getProfileWithStories } from "@/lib/data/stories";
import { initials, isAvatarUrl } from "@/lib/domain/avatars";
import { clampText, OG_CACHE_CONTROL, OG_SIZE } from "@/lib/domain/og";
import { publicEnv } from "@/lib/env";
import { avatarPngDataUrl, flameDataUrl, ogFonts } from "@/lib/og/assets";
import { ProfileCard } from "@/lib/og/cards";

/** Share preview for a profile, in the person's own language. */
export async function GET(_request: Request, { params }: RouteContext<"/api/og/profile/[handle]">) {
  const { handle } = await params;
  const profile = await getProfileWithStories(handle);
  if (!profile) return new Response("Not found", { status: 404 });

  const name = profile.displayName || profile.username;
  const [t, flame, fonts, photo] = await Promise.all([
    getTranslations({ locale: profile.locale, namespace: "Profile" }),
    flameDataUrl(),
    ogFonts(),
    isAvatarUrl(profile.avatarUrl, publicEnv.NEXT_PUBLIC_SUPABASE_URL) ? avatarPngDataUrl(profile.avatarUrl, 280) : null,
  ]);
  const stats =
    profile.storyCount > 0
      ? `${t("storyCount", { count: profile.storyCount })} · ${t("wordCount", { count: profile.wordCount })}`
      : "";
  return new ImageResponse(
    (
      <ProfileCard
        flame={flame}
        photo={photo}
        initials={initials(name)}
        name={clampText(name, 60)}
        handle={profile.pronouns ? `@${profile.username} · ${profile.pronouns}` : `@${profile.username}`}
        bio={clampText(profile.bio, 170)}
        stats={stats}
      />
    ),
    { ...OG_SIZE, fonts, headers: { "Cache-Control": OG_CACHE_CONTROL } },
  );
}
