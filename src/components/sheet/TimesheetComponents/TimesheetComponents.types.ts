import type { DropzoneFile } from "@/src/components/ui/Dropzone";
import type { TimesheetStatus } from "../StatusPill";
import type { TimesheetSummaryAction } from "../TimesheetSummaryCard";

export type TimesheetBreakdownRow = {
  id: string;
  project: string;
  hours: number | string;
  rate: string;
  amount: string;
};

export type TimesheetComponentsProps = {
  status?: TimesheetStatus;
  title?: string;
  meta?: string;
  action?: TimesheetSummaryAction;
  breakdownRows?: TimesheetBreakdownRow[];
  invoiceFiles?: DropzoneFile[];
  onInvoiceFilesSelected?: (files: File[]) => void;
  className?: string;
};
