"use client";

import { Toaster, toast } from "sonner";

import type { ToastKind } from "./Toast.types";

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

export function notify(kind: ToastKind, message: string) {
  if (kind === "success") return toast.success(message);
  if (kind === "error") return toast.error(message);
  if (kind === "warning") return toast.warning(message);
  return toast(message);
}
