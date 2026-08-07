export type CalendarLabels = {
  /** Accessible name of the previous-month button. Defaults to `"Previous month"`. */
  previousMonth?: string;
  /** Accessible name of the next-month button. Defaults to `"Next month"`. */
  nextMonth?: string;
  /** Accessible name of the month grid. Defaults to `"Calendar"`. */
  monthGrid?: string;
};

export type CalendarRangeValue = {
  from?: string;
  to?: string;
};

type CalendarBaseProps = {
  /** BCP-47 tag driving every `Intl` formatter in the grid. Pass `useLocale()`. */
  locale: string;
  /** Inclusive bounds as `YYYY-MM-DD`. Days outside them render disabled. */
  min?: string;
  max?: string;
  /** Receives a `YYYY-MM-DD` value, never a `Date`. */
  disabledDates?: (value: string) => boolean;
  numberOfMonths?: number;
  labels?: CalendarLabels;
  className?: string;
  autoFocus?: boolean;
};

export type CalendarSingleProps = CalendarBaseProps & {
  mode?: "single";
  /** `YYYY-MM-DD`. */
  value?: string;
  onValueChange?: (value: string | undefined) => void;
};

export type CalendarRangeProps = CalendarBaseProps & {
  mode: "range";
  value?: CalendarRangeValue;
  onValueChange?: (value: CalendarRangeValue) => void;
};

export type CalendarProps = CalendarSingleProps | CalendarRangeProps;
