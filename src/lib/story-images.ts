import { publicEnv } from "@/lib/env";
import { storyImagePrefix } from "@/lib/domain/stories";

/** Where story images may come from: Unsplash (hotlinked) and our own bucket. */
export function allowedImagePrefixes(): readonly string[] {
  return ["https://images.unsplash.com/", storyImagePrefix(publicEnv.NEXT_PUBLIC_SUPABASE_URL)];
}

export function isAllowedStoryImage(url: string): boolean {
  return allowedImagePrefixes().some((prefix) => url.startsWith(prefix));
}
