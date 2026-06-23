import type { HTMLAttributes } from "react";

export type DatePickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: Date;
  onValueChange?: (value: Date | undefined) => void;
  label: string;
  placeholder?: string;
  disabledDate?: (date: Date) => boolean;
  clearable?: boolean;
};
