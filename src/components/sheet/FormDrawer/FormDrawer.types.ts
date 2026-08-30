import type { HTMLAttributes, ReactNode } from "react";

export type FormDrawerDiscardLabels = {
  title: string;
  description: string;
  confirm: string;
  cancel: string;
};

export type FormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /**
   * True while the form holds input the user has not saved. Guards every dismissal Radix
   * offers — the scrim, Escape and the close button — behind a confirmation.
   */
  dirty?: boolean;
  discardLabels?: Partial<FormDrawerDiscardLabels>;
  closeLabel?: string;
  /** The `<form>`. Lay it out as `flex min-h-0 flex-1 flex-col` so the body scrolls under the header. */
  children: ReactNode;
  className?: string;
};

export type FormDrawerBodyProps = HTMLAttributes<HTMLDivElement>;
export type FormDrawerFooterProps = HTMLAttributes<HTMLDivElement>;
