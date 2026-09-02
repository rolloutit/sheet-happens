"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import { cn } from "@/src/lib/utils";
import type {
  FormDrawerBodyProps,
  FormDrawerFooterProps,
  FormDrawerProps,
} from "./FormDrawer.types";

const FormDrawerCloseContext = createContext<(() => void) | null>(null);

/**
 * Closes the surrounding sheet through the same unsaved-input guard Radix's own dismissals
 * go through. A Cancel button inside the form must not be the one exit that skips it.
 */
export function useFormDrawerClose() {
  const close = useContext(FormDrawerCloseContext);

  if (!close) throw new Error("useFormDrawerClose must be used inside a FormDrawer");

  return close;
}

/**
 * The shell for creating or editing a record in a side sheet.
 *
 * A create form of this size does not belong in a dialog — it needs room for a single
 * column of fields, and the list it writes into stays readable behind the sheet, which is
 * how you check whether the thing you are about to create already exists. The header stays
 * put and the fields scroll under it, so the submit row never walks off the bottom.
 *
 * Compose it as `FormDrawer > form > FormDrawerBody + FormDrawerFooter`. The `<form>` has to
 * be the caller's, not ours, or the footer's submit button would sit outside it.
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  dirty,
  discardLabels,
  closeLabel = "Close",
  children,
  className,
}: FormDrawerProps) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const labels = {
    title: discardLabels?.title ?? "Discard your changes?",
    description: discardLabels?.description ?? "What you have filled in so far will not be saved.",
    confirm: discardLabels?.confirm ?? "Discard",
    cancel: discardLabels?.cancel ?? "Keep editing",
  };

  /**
   * Radix routes the scrim, Escape and the close button through a single `onOpenChange`,
   * so guarding here covers all three without touching `onInteractOutside` individually.
   */
  const requestOpenChange = useCallback(
    (next: boolean) => {
      if (!next && dirty) {
        setConfirmingDiscard(true);
        return;
      }

      onOpenChange(next);
    },
    [dirty, onOpenChange],
  );
  const requestClose = useCallback(() => requestOpenChange(false), [requestOpenChange]);

  return (
    <>
      <Drawer open={open} onOpenChange={requestOpenChange}>
        <DrawerContent
          closeLabel={closeLabel}
          className={cn("flex w-[min(40rem,100vw)] flex-col gap-0 p-0", className)}
        >
          <DrawerHeader className="gap-1 border-b border-border px-6 py-5">
            <DrawerTitle className="text-xl font-semibold text-foreground">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="text-sm leading-6 text-muted-foreground">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>
          <FormDrawerCloseContext.Provider value={requestClose}>
            {children}
          </FormDrawerCloseContext.Provider>
        </DrawerContent>
      </Drawer>

      <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <DialogContent className="max-w-md" closeLabel={closeLabel}>
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmingDiscard(false)}>
              {labels.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setConfirmingDiscard(false);
                onOpenChange(false);
              }}
            >
              {labels.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The scrolling region. Everything above the submit row goes here. */
export function FormDrawerBody({ className, ...props }: FormDrawerBodyProps) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

/** The pinned submit row. Stays reachable however long the field list grows. */
export function FormDrawerFooter({ className, ...props }: FormDrawerFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border bg-popover px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}
