import type { DropzoneFile } from "@/src/components/ui/Dropzone";
import type { ReactNode } from "react";

export type InvoiceUploadPanelProps = {
  title?: ReactNode;
  enabled?: boolean;
  enabledLabel?: ReactNode;
  lockedLabel?: ReactNode;
  lockedTitle?: string;
  lockedReason?: string;
  description?: string;
  files?: DropzoneFile[];
  onFilesSelected?: (files: File[]) => void;
  previewHint?: ReactNode;
  className?: string;
};
