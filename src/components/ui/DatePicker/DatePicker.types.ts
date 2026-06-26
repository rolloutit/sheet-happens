import type { HTMLAttributes } from "react";

export type DatePickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: Date;
  onValueChange?: (value: Date | undefined) => void;
  label: string;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
  disabledDate?: (date: Date) => boolean;
  clearable?: boolean;
};
