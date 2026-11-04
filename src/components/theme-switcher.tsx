"use client";

import { BookOpen, Laptop, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "sepia", icon: BookOpen },
  { value: "system", icon: Laptop },
] as const;

const subscribe = () => () => {};

export function ThemeSwitcher() {
  const t = useTranslations("Theme");
  const { theme, resolvedTheme, setTheme } = useTheme();
  // The stored theme is only known on the client; render a neutral icon until hydrated.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const active = hydrated ? (resolvedTheme ?? "light") : "light";
  const Icon = OPTIONS.find((o) => o.value === active)?.icon ?? Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("label")} data-testid="theme-switcher">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={hydrated ? (theme ?? "system") : undefined} onValueChange={setTheme}>
          {OPTIONS.map(({ value, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon className="text-muted-foreground" />
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
