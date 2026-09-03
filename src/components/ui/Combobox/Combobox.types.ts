import type { ReactNode } from "react";

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
  /**
   * Trigger text once more than one option is chosen. Multi-select only — a lone choice
   * always shows its own label, so this never has to spell out the singular.
   */
  selected?: (count: number) => string;
  /** The panel's clear action, shown in multi-select while anything is chosen. */
  clear?: string;
};

/**
 * An explicit contract rather than an extension of `HTMLAttributes<HTMLDivElement>`, which
 * this used to inherit. The wrapper is a layout element, not the control — the trigger takes
 * `id`, `aria-label`, `aria-describedby` and `triggerClassName` of its own — so letting
 * callers attach handlers and ARIA to the wrapper only invited them to land on the wrong
 * node. It also matches `SelectProps`, which has always been an explicit list.
 */
type ComboboxBaseProps = {
  /** Readonly so callers can pass frozen option tables straight through. */
  options: readonly ComboboxOption[];
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
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-describedby"?: string;
};

/** The default: one value, and picking an option closes the panel. */
export type ComboboxSingleProps = ComboboxBaseProps & {
  multiple?: false;
  /** Controlled value. Omit and use `defaultValue` inside a Server Action form. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/**
 * Multi-select: the panel stays open while picking, rows carry a checkbox, and the trigger
 * collapses to a count past the first choice.
 *
 * The hidden control becomes a `<select multiple>`, so a plain GET form serializes
 * `?name=a&name=b` with no encoding of its own; the reading side is `listSearchParam` in
 * `src/lib/search-params.ts`, which is what keeps every value rather than the first. An
 * empty array means "nothing filtered", which is why multi-select filters drop the
 * `{ value: "", label: "All …" }` sentinel option their single-select counterparts carry and
 * pass that label as `placeholder` instead.
 */
export type ComboboxMultipleProps = ComboboxBaseProps & {
  multiple: true;
  /** Controlled values. Omit and use `defaultValue` inside a Server Action form. */
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (values: string[]) => void;
};

export type ComboboxProps = ComboboxSingleProps | ComboboxMultipleProps;
