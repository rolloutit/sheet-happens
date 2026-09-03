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

type SelectBaseProps = {
  /** Readonly so callers can pass frozen option tables straight through. */
  options: readonly SelectOption[];
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
   * `searchThreshold`. Pass `true` or `false` to decide at the call site. Ignored under
   * `multiple`, which is always searchable.
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

/** The default: one value. */
export type SelectSingleProps = SelectBaseProps & {
  multiple?: false;
  /** Controlled value. Omit and use `defaultValue` inside a Server Action form. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/** Multi-select. Always takes the `Combobox` path; see the note on `Select`. */
export type SelectMultipleProps = SelectBaseProps & {
  multiple: true;
  /** Controlled values. Omit and use `defaultValue` inside a Server Action form. */
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (values: string[]) => void;
};

export type SelectProps = SelectSingleProps | SelectMultipleProps;

/**
 * The Radix menu path. Everything a single `Select` accepts except the search-related props
 * — and never `multiple`, which Radix's Select cannot express.
 */
export type SelectMenuProps = Omit<
  SelectSingleProps,
  "searchable" | "searchThreshold" | "labels" | "multiple"
>;
