"use client";

import { Toaster, toast } from "sonner";

import type { ToastKind, ToastOptions } from "./Toast.types";

export function SheetToaster() {
  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-popover text-popover-foreground shadow-panel font-ui rounded-[var(--radius-lg)]",
          actionButton: "bg-accent text-accent-foreground",
          cancelButton: "bg-secondary text-secondary-foreground",
        },
      }}
    />
  );
}

export function notify(kind: ToastKind, message: string, options?: ToastOptions) {
  if (kind === "success") return toast.success(message, options);
  if (kind === "error") return toast.error(message, options);
  if (kind === "warning") return toast.warning(message, options);
  return toast(message, options);
}
