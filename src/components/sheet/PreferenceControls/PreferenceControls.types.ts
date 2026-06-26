import type { ComboboxOption } from "@/src/components/ui/Combobox";
import type { ReactNode } from "react";

export type PreferenceLanguageOption = {
  value: string;
  label: ReactNode;
};

export type PreferenceControlsProps = {
  title?: string;
  description?: ReactNode;
  avatarTitle?: ReactNode;
  avatarDescription?: ReactNode;
  avatarActionLabel?: ReactNode;
  timezoneValue?: string;
  timezoneOptions: ComboboxOption[];
  onTimezoneChange?: (value: string) => void;
  languageValue?: string;
  languageOptions?: PreferenceLanguageOption[];
  onLanguageChange?: (value: string) => void;
  onAvatarChange?: () => void;
  className?: string;
};
