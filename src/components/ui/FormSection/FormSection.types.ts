import type { ReactNode } from "react";

export type FormSectionProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};
