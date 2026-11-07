"use client";

import { ArrowDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getReadingPosition } from "@/app/actions/reading";
import { LOCAL_POSITIONS_KEY, readLocalPositions, worthResuming, type ReadingPosition } from "@/lib/domain/reading-position";
import { scrollBehavior } from "@/lib/utils";

/**
 * "Pick up where you left off": when a reader comes back to a story they didn't finish, a small
 * pill offers to jump to the paragraph where they stopped (from their account when signed in, else
 * from this browser). Fixed in place, so it never pushes the text around; gone once they scroll.
 */
export function ResumeReading({ storyId, signedIn }: { storyId: string; signedIn: boolean }) {
  const t = useTranslations("Resume");
  const [position, setPosition] = useState<(ReadingPosition & { blockId: string }) | null>(null);

  useEffect(() => {
    // Arriving at a passage link, or already reading: don't interrupt.
    if (window.location.hash || window.scrollY > 200) return;
    let cancelled = false;
    void (async () => {
      let found: ReadingPosition | null = null;
      if (signedIn) {
        found = await getReadingPosition(storyId).catch(() => null);
      } else {
        try {
          found = readLocalPositions(window.localStorage.getItem(LOCAL_POSITIONS_KEY))[storyId] ?? null;
        } catch {
          found = null;
        }
      }
      if (cancelled || !worthResuming(found) || window.scrollY > 200) return;
      if (document.getElementById(`p-${found.blockId}`)) setPosition(found);
    })();
    const onScroll = () => {
      if (window.scrollY > 400) setPosition(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
    };
  }, [storyId, signedIn]);

  if (!position) return null;
  return (
    <div
      role="region"
      aria-label={t("label")}
      className="fixed top-[4.25rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-background/95 p-1 font-sans text-sm shadow-lg backdrop-blur"
      data-testid="resume-reading"
    >
      <button
        type="button"
        className="flex min-h-10 items-center gap-1.5 rounded-full px-3 whitespace-nowrap hover:bg-muted sm:min-h-8"
        onClick={() => {
          document.getElementById(`p-${position.blockId}`)?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
          setPosition(null);
        }}
      >
        <ArrowDown className="size-4 text-ember-text" aria-hidden />
        {t("resume", { percent: Math.round(position.progress * 100) })}
      </button>
      <button
        type="button"
        className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted sm:size-8"
        aria-label={t("dismiss")}
        onClick={() => setPosition(null)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
