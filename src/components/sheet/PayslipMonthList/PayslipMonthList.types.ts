import type { ReactNode } from "react";
import type { PayslipStatus } from "../PayslipStatus";

export type PayslipMonthItem = {
  id: string;
  month: string;
  status: PayslipStatus;
  fileName?: string;
  meta?: ReactNode;
};

export type PayslipMonthListLabels = {
  title?: ReactNode;
  empty?: ReactNode;
  preview?: (item: PayslipMonthItem) => string;
  download?: (item: PayslipMonthItem) => string;
};

export type PayslipMonthListProps = {
  items: PayslipMonthItem[];
  selectedId?: string;
  onPreview?: (item: PayslipMonthItem) => void;
  onDownload?: (item: PayslipMonthItem) => void;
  labels?: PayslipMonthListLabels;
  className?: string;
};
