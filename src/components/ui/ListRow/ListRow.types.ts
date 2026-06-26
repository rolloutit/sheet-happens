import type { ReactNode } from "react";

export type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
};
