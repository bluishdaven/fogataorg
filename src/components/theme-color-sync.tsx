"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { APP_THEME } from "@/lib/domain/app";

/**
 * Keeps the browser's own bars (status bar, the installed app's title bar) the color of the theme the
 * reader chose on Fogata, not only the phone's light/dark setting. The page itself also draws behind
 * the phone's gesture bar (viewport-fit=cover), so the bottom matches too.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? APP_THEME.dark : resolvedTheme === "sepia" ? APP_THEME.sepia : resolvedTheme === "light" ? APP_THEME.light : null;
    if (!color) return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = color;
  }, [resolvedTheme]);
  return null;
}
