import type { ReactNode } from "react";

export type FieldRenderProps = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
};

export type FieldProps = {
  id?: string;
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  reserveMessageSpace?: boolean;
  children: ReactNode | ((field: FieldRenderProps) => ReactNode);
  className?: string;
};
