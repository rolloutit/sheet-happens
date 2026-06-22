import type { ReactNode } from "react";

export type FieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};
