import type { DropzoneFile } from "@/src/components/ui/Dropzone";
import type { ReactNode } from "react";

export type PayslipUploadPanelProps = {
  title?: ReactNode;
  description?: string;
  selectedEmployee?: ReactNode;
  selectedMonth?: ReactNode;
  files?: DropzoneFile[];
  disabled?: boolean;
  uploadLabel?: ReactNode;
  onFilesSelected?: (files: File[]) => void;
  onUpload?: () => void;
  className?: string;
};
