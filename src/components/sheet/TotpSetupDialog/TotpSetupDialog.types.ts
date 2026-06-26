import type { ReactNode } from "react";

export type TotpSetupDialogProps = {
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  secret?: string;
  codeValue?: string;
  codeLabel?: string;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmDisabled?: boolean;
  onCodeChange?: (value: string) => void;
  onConfirm?: (code: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};
