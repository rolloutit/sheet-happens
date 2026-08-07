import type { HTMLAttributes } from "react";

import type { CalendarLabels } from "../Calendar";

export type DatePickerLabels = CalendarLabels & {
  /** Clears the selection. Defaults to `"Clear"`. */
  clear?: string;
  /** Jumps to and selects today. Defaults to `"Today"`. */
  today?: string;
};

export type DatePickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> & {
  /** `YYYY-MM-DD`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  /** Submits under this name via a hidden input. */
  name?: string;
  /** Associates with a `<form>` by id, like the native attribute. */
  form?: string;
  label: string;
  placeholder?: string;
  /**
   * BCP-47 tag. Required rather than defaulting: this app's default locale is Hungarian,
   * and a silent `"en"` fallback would render English dates inside a Hungarian screen.
   * Client call sites pass `useLocale()`.
   */
  locale: string;
  /** Inclusive `YYYY-MM-DD` bounds. Days outside them render disabled. */
  min?: string;
  max?: string;
  disabledDates?: (value: string) => boolean;
  labels?: DatePickerLabels;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  /** Radix Popover modality. Defaults to `true`; see `ComboboxProps.modal`. */
  modal?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-describedby"?: string;
};
