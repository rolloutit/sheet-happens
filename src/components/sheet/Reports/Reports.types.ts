import type { TableSort } from "@/src/components/ui/Table";
import type { DocumentPreviewMode, DocumentPreviewRow } from "../DocumentPreview";
import type { ReportChartDatum, ReportDistributionItem } from "../ReportChartCard";
import type { ReportExportFormat } from "../ReportExportDialog";
import type { ReportStatTileProps } from "../ReportStatTile";

export type ReportTableRow = {
  id: string;
  project: string;
  user: string;
  hours: number;
  amount: string;
};

export type ReportsProps = {
  mode?: DocumentPreviewMode;
  periodValue?: string;
  projectValue?: string;
  view?: "user" | "project";
  stats?: ReportStatTileProps[];
  chartData?: ReportChartDatum[];
  distribution?: ReportDistributionItem[];
  documentTitle?: string;
  documentRows?: DocumentPreviewRow[];
  rows?: ReportTableRow[];
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  onPeriodChange?: (value: string) => void;
  onProjectChange?: (value: string) => void;
  onViewChange?: (value: "user" | "project") => void;
  onExport?: (format: ReportExportFormat) => void;
  className?: string;
};
