export type PdfViewerState = "empty" | "loading" | "ready" | "error";

export type PdfViewerLabels = {
  previousPage?: string;
  nextPage?: string;
  zoomOut?: string;
  zoomIn?: string;
  download?: string;
  openExternal?: string;
  emptyTitle?: string;
  emptyBody?: string;
  errorTitle?: string;
  errorBody?: string;
  loading?: string;
};

export type PdfViewerProps = {
  title: string;
  src?: string;
  state?: PdfViewerState;
  page?: number;
  totalPages?: number;
  scale?: number;
  labels?: PdfViewerLabels;
  className?: string;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onDownload?: () => void;
  onOpenExternal?: () => void;
};
