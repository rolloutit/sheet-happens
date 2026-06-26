import type { ReactNode } from "react";

export type DocumentPreviewMode = "cost-free" | "internal";

export type DocumentPreviewRow = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  internalOnly?: boolean;
};

export type DocumentPreviewProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  mode?: DocumentPreviewMode;
  rows: DocumentPreviewRow[];
  className?: string;
};
