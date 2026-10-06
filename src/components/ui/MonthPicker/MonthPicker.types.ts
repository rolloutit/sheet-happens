import type { HTMLAttributes } from "react";

export type MonthPickerLabels = {
  /** Accessible name of the previous-year button. Defaults to `"Previous year"`. */
  previousYear?: string;
  /** Accessible name of the next-year button. Defaults to `"Next year"`. */
  nextYear?: string;
  /** Accessible name of the month grid. Defaults to `"Select month"`. */
  monthGrid?: string;
  /** Clears the selection. Defaults to `"Clear"`. */
  clear?: string;
  /** Jumps to and selects the current month. Defaults to `"This month"`. */
  thisMonth?: string;
};

export type MonthPickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> & {
  /** `YYYY-MM`. Never `YYYY-MM-01` — see the note on the component. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  name?: string;
  form?: string;
  label: string;
  placeholder?: string;
  /** BCP-47 tag. Required for the same reason as `DatePickerProps.locale`. */
  locale: string;
  /** Inclusive `YYYY-MM` bounds. */
  min?: string;
  max?: string;
  labels?: MonthPickerLabels;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  modal?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-describedby"?: string;
};

export type MonthPickerPanelProps = {
  /** `YYYY-MM`, or `undefined` for no selection. */
  value?: string;
  locale: string;
  /** Inclusive `YYYY-MM` bounds. */
  min?: string;
  max?: string;
  labels?: MonthPickerLabels;
  /** Whether the footer offers a clear action, which calls `onSelect(undefined)`. */
  clearable?: boolean;
  /** The year the grid opens on. Defaults to the selected month's year, else the current one. */
  initialYear?: number;
  onSelect: (month: string | undefined) => void;
};
