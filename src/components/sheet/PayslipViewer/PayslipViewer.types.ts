import type { ReactNode } from "react";

export type PayslipViewerState = "loading" | "ready" | "error" | "empty";

export type PayslipViewerProps = {
  title?: ReactNode;
  fileName?: ReactNode;
  state?: PayslipViewerState;
  meta?: ReactNode;
  error?: ReactNode;
  openLabel?: ReactNode;
  downloadLabel?: ReactNode;
  onOpen?: () => void;
  onDownload?: () => void;
  className?: string;
};
