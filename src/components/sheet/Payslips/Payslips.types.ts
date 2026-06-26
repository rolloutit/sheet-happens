import type { DropzoneFile } from "@/src/components/ui/Dropzone";
import type { TableSort } from "@/src/components/ui/Table";
import type { ReactNode } from "react";
import type { PayslipAdminRow } from "../PayslipAdminTable";
import type { PayslipMonthItem } from "../PayslipMonthList";
import type { PayslipViewerProps } from "../PayslipViewer";

export type PayslipRole = "employee" | "admin";

export type PayslipsProps = {
  role?: PayslipRole;
  latest?: PayslipMonthItem;
  months?: PayslipMonthItem[];
  selectedPayslipId?: string;
  viewer?: PayslipViewerProps;
  adminRows?: PayslipAdminRow[];
  adminSort?: TableSort | null;
  uploadFiles?: DropzoneFile[];
  uploadEmployee?: ReactNode;
  uploadMonth?: ReactNode;
  onAdminSortChange?: (sort: TableSort) => void;
  onPreviewPayslip?: (item: PayslipMonthItem) => void;
  onDownloadPayslip?: (item: PayslipMonthItem) => void;
  onUploadFilesSelected?: (files: File[]) => void;
  onUpload?: () => void;
  onAdminPreview?: (row: PayslipAdminRow) => void;
  onAdminDownload?: (row: PayslipAdminRow) => void;
  onAdminUpload?: (row: PayslipAdminRow) => void;
  className?: string;
};
