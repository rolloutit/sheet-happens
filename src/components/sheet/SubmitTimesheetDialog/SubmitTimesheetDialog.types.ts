import type { ReactNode } from "react";

export type SubmitTimesheetDialogProps = {
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  details?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onConfirm?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
