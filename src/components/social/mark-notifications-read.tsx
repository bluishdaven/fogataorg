"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/app/actions/social";

/** Marks everything read once the reader has seen the list (the bell updates via Realtime). */
export function MarkNotificationsRead() {
  useEffect(() => {
    const timer = setTimeout(() => void markNotificationsRead(), 1500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
