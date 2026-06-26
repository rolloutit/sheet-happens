import type { ReactNode } from "react";

export type RejectDialogProps = {
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  reason?: string;
  onReasonChange?: (reason: string) => void;
  onReject?: (reason: string) => void;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
