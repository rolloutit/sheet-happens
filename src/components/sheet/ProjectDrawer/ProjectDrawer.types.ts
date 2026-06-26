import type { ReactNode } from "react";

export type ProjectDrawerMember = {
  id: string;
  name: string;
};

export type ProjectDrawerData = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  dateRange?: string;
  tags?: string[];
  members?: ProjectDrawerMember[];
  notes?: string;
  rateSource?: string;
};

export type ProjectDrawerProps = {
  project: ProjectDrawerData;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onActiveChange?: (active: boolean) => void;
  onSave?: (project: ProjectDrawerData) => void;
  saveLabel?: ReactNode;
  cancelLabel?: ReactNode;
};
