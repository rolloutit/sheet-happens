import type { HTMLAttributes } from "react";

export type CodeInputProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  label: string;
  length?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
};
