import type { HTMLAttributes } from "react";

export type DropzoneFileStatus = "ready" | "uploading" | "done" | "error";

export type DropzoneFile = {
  id: string;
  name: string;
  sizeLabel: string;
  status?: DropzoneFileStatus;
  progress?: number;
};

export type DropzoneProps = Omit<HTMLAttributes<HTMLDivElement>, "onDrop"> & {
  label: string;
  description?: string;
  browseLabel?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  files?: DropzoneFile[];
  error?: string;
  statusLabels?: Partial<Record<DropzoneFileStatus, string>>;
  onFilesSelected?: (files: File[]) => void;
  onFilesRejected?: (files: File[]) => void;
};
