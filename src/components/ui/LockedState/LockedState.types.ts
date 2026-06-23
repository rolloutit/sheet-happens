import type { ReactNode } from "react";

export type LockedStateProps = {
  title: string;
  reason: string;
  meta?: string;
  action?: ReactNode;
  className?: string;
};
