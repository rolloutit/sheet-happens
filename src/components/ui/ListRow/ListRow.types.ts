import type { ReactNode } from "react";

export type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};
