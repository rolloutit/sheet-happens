import type { HTMLAttributes, ReactNode } from "react";

export type SegmentItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  count?: number;
};

export type SegmentedControlProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  items: SegmentItem[];
  value: string;
  onValueChange?: (value: string) => void;
  label: string;
  size?: "sm" | "md";
};
