import type { HTMLAttributes, ReactNode } from "react";

export type LanguageToggleOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type LanguageToggleProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value: string;
  options?: LanguageToggleOption[];
  label?: string;
  size?: "sm" | "md";
  width?: "auto" | "full";
  onValueChange?: (value: string) => void;
};
