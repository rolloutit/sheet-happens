import type { HTMLAttributes } from "react";

export type DropzoneFile = {
  id: string;
  name: string;
  sizeLabel: string;
  status?: "ready" | "uploading" | "done" | "error";
  progress?: number;
};

export type DropzoneProps = Omit<HTMLAttributes<HTMLDivElement>, "onDrop"> & {
  label: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  files?: DropzoneFile[];
  error?: string;
  onFilesSelected?: (files: File[]) => void;
};
