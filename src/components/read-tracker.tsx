"use client";

import { useEffect } from "react";
import { READ_THRESHOLD } from "@/lib/domain/reads";

/**
 * Tells the server how far the reader got (anonymous reading counts): once when they pass half the
 * story, and again when they leave. No cookies.
 */
export function ReadTracker({ storyId, targetId }: { storyId: string; targetId: string }) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    let furthest = 0;
    let visibleMs = 0;
    let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
    let sentHalf = false;

    const seconds = () => Math.round((visibleMs + (visibleSince === null ? 0 : performance.now() - visibleSince)) / 1000);
    const send = () => {
      // A glance isn't a read; the server keeps the furthest point if this arrives twice.
      if (furthest < 0.1 && seconds() < 10) return;
      const body = JSON.stringify({ storyId, ratio: Math.round(furthest * 100) / 100, seconds: Math.min(seconds(), 86_400) });
      if (!navigator.sendBeacon?.("/api/reads", body)) {
        void fetch("/api/reads", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    };
    const measure = () => {
      const rect = target.getBoundingClientRect();
      // How much of the story has come into view: the bottom of the window inside the text.
      const seen = rect.height <= 0 ? 0 : (window.innerHeight - rect.top) / rect.height;
      furthest = Math.max(furthest, Math.min(1, Math.max(0, seen)));
      if (!sentHalf && furthest >= READ_THRESHOLD) {
        sentHalf = true;
        send();
      }
    };
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) visibleMs += performance.now() - visibleSince;
        visibleSince = null;
        send();
      } else {
        visibleSince = performance.now();
      }
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      // Leaving through an in-app link doesn't fire pagehide.
      send();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      cancelAnimationFrame(frame);
    };
  }, [storyId, targetId]);

  return null;
}
