import type { ReactNode } from "react";

export type SectionHeadProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};
