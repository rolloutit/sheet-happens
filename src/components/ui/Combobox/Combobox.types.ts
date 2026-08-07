import type { HTMLAttributes, ReactNode } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary line under the label. Searchable when it is a plain string. */
  meta?: ReactNode;
  /** Extra search aliases. Option values are never searched — put searchable ids here. */
  keywords?: string[];
  disabled?: boolean;
};

export type ComboboxLabels = {
  /** Accessible name of the search field. Defaults to `"Search"`. */
  search?: string;
  /** Placeholder inside the search field. Defaults to `"Search..."`. */
  searchPlaceholder?: string;
  /** Shown when nothing matches the query. Defaults to `"No results"`. */
  empty?: string;
};

export type ComboboxProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> & {
  /** Readonly so callers can pass frozen option tables straight through. */
  options: readonly ComboboxOption[];
  /** Controlled value. Omit and use `defaultValue` inside a Server Action form. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits under this name via a visually hidden `<select>`. */
  name?: string;
  /** Associates with a `<form>` by id, like the native attribute. */
  form?: string;
  label: string;
  placeholder?: string;
  labels?: ComboboxLabels;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  /**
   * Radix Popover modality. Defaults to `true`, matching Radix Select, because these open
   * inside Dialogs and Drawers whose focus scope would otherwise reclaim focus.
   */
  modal?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-describedby"?: string;
};
