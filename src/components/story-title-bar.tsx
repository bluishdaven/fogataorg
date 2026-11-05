"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

/**
 * A slim bar under the site header that keeps the story's title and writer in view once the
 * story's own header has scrolled away, and leaves again past the end of the story. It repeats
 * what's already on the page, so it's hidden from screen readers and holds nothing to tab to.
 */
export function StoryTitleBar({
  headerId,
  storyId,
  title,
  authorName,
  avatarUrl,
  lang,
}: {
  /** The story's header (title and byline); the bar shows once it's above the site header. */
  headerId: string;
  /** The whole story; the bar hides once its end is above the bar. */
  storyId: string;
  title: string;
  authorName: string;
  avatarUrl: string | null;
  lang: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const header = document.getElementById(headerId);
    const story = document.getElementById(storyId);
    const siteHeader = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header || !story) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = siteHeader?.getBoundingClientRect().bottom ?? 0;
      const BAR = 48;
      setShown(header.getBoundingClientRect().bottom < top && story.getBoundingClientRect().bottom > top + BAR);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [headerId, storyId]);

  return (
    <div
      aria-hidden
      inert
      className={cn(
        "fixed inset-x-0 top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md transition-[opacity,transform,visibility] duration-200 ease-out supports-[backdrop-filter]:bg-background/75 sm:top-14",
        shown ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
      )}
      data-testid="story-title-bar"
      data-shown={shown}
    >
      <div className="mx-auto flex h-12 max-w-[var(--measure)] items-center gap-2.5 px-4">
        <Avatar name={authorName} url={avatarUrl} className="size-7 shrink-0 text-[0.625rem]" />
        {/* Title over writer: both fit on a phone without squeezing the title. */}
        <p className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-serif text-[0.9375rem] font-semibold" lang={lang}>
            {title}
          </span>
          <span className="truncate text-xs text-muted-foreground">{authorName}</span>
        </p>
      </div>
    </div>
  );
}
