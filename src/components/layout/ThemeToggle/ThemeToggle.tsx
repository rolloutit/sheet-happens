"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Dropdown,
  DropdownContent,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { iconButtonVariants } from "@/src/components/ui/IconButton";
import { isThemePreference, themePreferences } from "@/src/lib/theme";
import { cn } from "@/src/lib/utils";
import { useTheme } from "../ThemeProvider";
import type { ThemeToggleProps } from "./ThemeToggle.types";

const optionIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function ThemeToggle({ align = "end", className, size, variant }: ThemeToggleProps) {
  const t = useTranslations("ThemeToggle");
  const { preference, setTheme } = useTheme();

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={t("label")}
          title={t("label")}
          className={cn(iconButtonVariants({ size, variant }), className)}
        >
          {/*
            The trigger icon is driven by the `dark` class rather than by `resolvedTheme`, which is
            undefined during SSR and the first client render. That keeps the server and client
            markup identical — no hydration guard, no pop-in — at the cost of showing the resolved
            theme rather than the preference. Which option is selected lives in the menu below.
          */}
          <Sun className="size-4 dark:hidden" aria-hidden="true" />
          <Moon className="hidden size-4 dark:block" aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent align={align} className="min-w-44">
        <DropdownLabel>{t("label")}</DropdownLabel>
        {/*
          The menu only renders while open, so it always mounts after hydration and can read
          `preference` freely.
        */}
        <DropdownRadioGroup
          value={preference}
          onValueChange={(next) => {
            if (isThemePreference(next)) setTheme(next);
          }}
        >
          {themePreferences.map((option) => {
            const Icon = optionIcons[option];

            return (
              <DropdownRadioItem key={option} value={option}>
                <Icon className="size-4" aria-hidden="true" />
                {t(option)}
              </DropdownRadioItem>
            );
          })}
        </DropdownRadioGroup>
      </DropdownContent>
    </Dropdown>
  );
}
