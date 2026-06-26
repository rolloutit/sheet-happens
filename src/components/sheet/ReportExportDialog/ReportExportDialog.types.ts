import type { ReactNode } from "react";
import type { DocumentPreviewMode, DocumentPreviewRow } from "../DocumentPreview";

export type ReportExportFormat = "xlsx" | "csv" | "pdf";

export type ReportExportDialogProps = {
  trigger?: ReactNode | false;
  title?: ReactNode;
  description?: ReactNode;
  documentTitle: ReactNode;
  documentRows: DocumentPreviewRow[];
  mode?: DocumentPreviewMode;
  formats?: ReportExportFormat[];
  onExport?: (format: ReportExportFormat) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
