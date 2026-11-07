"use client";

import { Type } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_READER_PREFS,
  parseReaderPrefs,
  READER_FONTS,
  READER_PREFS_KEY,
  READER_SIZES,
  READER_WIDTHS,
  readerPrefsAttributes,
  type ReaderPrefs,
} from "@/lib/domain/reader-prefs";

function loadPrefs(): ReaderPrefs {
  try {
    return parseReaderPrefs(window.localStorage.getItem(READER_PREFS_KEY));
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

function applyPrefs(prefs: ReaderPrefs) {
  const dataset = document.documentElement.dataset;
  for (const [key, value] of Object.entries(readerPrefsAttributes(prefs))) {
    if (value) dataset[key] = value;
    else delete dataset[key];
  }
  try {
    window.localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: the change still applies to this page.
  }
}

/** "Aa" menu on story pages: text size, typeface, line width and theme. */
export function ReaderControls() {
  const t = useTranslations("Reader");
  const { theme, setTheme } = useTheme();
  // Read lazily when the menu opens; the pre-paint script already applied saved prefs.
  const [prefs, setPrefs] = useState<ReaderPrefs | null>(null);

  const update = (patch: Partial<ReaderPrefs>) => {
    const next = { ...(prefs ?? loadPrefs()), ...patch };
    setPrefs(next);
    applyPrefs(next);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && setPrefs(loadPrefs())}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("label")} data-testid="reader-controls">
          <Type />
          <span className="hidden sm:inline">{t("short")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{t("size")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs?.size} onValueChange={(size) => update({ size: size as ReaderPrefs["size"] })}>
          {READER_SIZES.map((size) => (
            <DropdownMenuRadioItem key={size} value={size}>
              {t(`sizes.${size}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("font")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs?.font} onValueChange={(font) => update({ font: font as ReaderPrefs["font"] })}>
          {READER_FONTS.map((font) => (
            <DropdownMenuRadioItem
              key={font}
              value={font}
              className={font === "serif" ? "font-serif" : font === "readable" ? "font-[family-name:var(--font-readable)]" : "font-sans"}
            >
              {font === "readable" ? (
                <span className="flex flex-col">
                  {t("fonts.readable")}
                  <span className="text-xs text-muted-foreground">{t("readableHint")}</span>
                </span>
              ) : (
                t(`fonts.${font}`)
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("width")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs?.width} onValueChange={(width) => update({ width: width as ReaderPrefs["width"] })}>
          {READER_WIDTHS.map((width) => (
            <DropdownMenuRadioItem key={width} value={width}>
              {t(`widths.${width}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs ? (theme ?? "system") : undefined} onValueChange={setTheme}>
          {(["light", "dark", "sepia", "system"] as const).map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(`themes.${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
