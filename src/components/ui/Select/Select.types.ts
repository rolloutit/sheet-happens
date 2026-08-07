import type { ReactNode } from "react";

import type { ComboboxLabels } from "../Combobox";

export type SelectOption = {
  value: string;
  label: string;
  /** Secondary line under the label. Searchable when it is a plain string. */
  meta?: ReactNode;
  /** Extra search aliases, used only on the searchable path. */
  keywords?: string[];
  disabled?: boolean;
};

export type SelectProps = {
  options: SelectOption[];
  /** Controlled value. Omit and use `defaultValue` inside a Server Action form. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits under this name. Both paths emit a hidden native select. */
  name?: string;
  /** Associates with a `<form>` by id, like the native attribute. */
  form?: string;
  label?: string;
  placeholder?: string;
  /** Search-field strings. Only reaches the searchable path. */
  labels?: ComboboxLabels;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  /**
   * `"auto"` (the default) turns search on once `options.length` exceeds
   * `searchThreshold`. Pass `true` or `false` to decide at the call site.
   */
  searchable?: boolean | "auto";
  searchThreshold?: number;
  /** Radix modality for the searchable path. See `ComboboxProps.modal`. */
  modal?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/** The Radix menu path. Everything `Select` accepts except the search-related props. */
export type SelectMenuProps = Omit<SelectProps, "searchable" | "searchThreshold" | "labels">;
