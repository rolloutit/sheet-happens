import type { HTMLAttributes, ReactNode } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  meta?: ReactNode;
  disabled?: boolean;
};

export type ComboboxProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
};
