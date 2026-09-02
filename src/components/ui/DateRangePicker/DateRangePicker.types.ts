import type { HTMLAttributes } from "react";

import type { CalendarRangeValue } from "../Calendar";
import type { DatePickerLabels } from "../DatePicker";

export type DateRangeValue = CalendarRangeValue;

export type DateRangePickerLabels = DatePickerLabels & {
  /** Placeholder half shown when only a start is chosen. Defaults to `"End date"`. */
  to?: string;
  /** Closes the panel once both ends are chosen. Defaults to `"Done"`. */
  done?: string;
};

export type DateRangePickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> & {
  value?: DateRangeValue;
  defaultValue?: DateRangeValue;
  onValueChange?: (value: DateRangeValue) => void;
  /**
   * Hidden input names for each end, e.g. `{ from: "validFrom", to: "validTo" }`. The pairs
   * already in the app (`start`/`end`, `from`/`to`, `startsOn`/`endsOn`) submit unchanged.
   */
  names?: { from: string; to: string };
  form?: string;
  label: string;
  placeholder?: string;
  /** BCP-47 tag. Required for the same reason as `DatePickerProps.locale`. */
  locale: string;
  min?: string;
  max?: string;
  disabledDates?: (value: string) => boolean;
  /** Defaults to 2, narrowed to 1 under 40rem. */
  numberOfMonths?: number;
  labels?: DateRangePickerLabels;
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
