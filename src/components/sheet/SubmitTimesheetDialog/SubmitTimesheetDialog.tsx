"use client";

import { Send } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import type { SubmitTimesheetDialogProps } from "./SubmitTimesheetDialog.types";

export function SubmitTimesheetDialog({
  trigger,
  title = "Submit timesheet?",
  description = "Submitted timesheets are locked for approval. You can only edit them again if an admin rejects the submission.",
  details,
  confirmLabel = "Submit timesheet",
  cancelLabel = "Cancel",
  onConfirm,
  open,
  onOpenChange,
}: SubmitTimesheetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="cta" icon={Send}>
            Submit timesheet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {details ? (
          <div className="rounded-[var(--radius-md)] bg-secondary p-3 text-sm">{details}</div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="cta" icon={Send} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
