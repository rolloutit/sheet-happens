"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

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
import { Field } from "@/src/components/ui/Field";
import { Textarea } from "@/src/components/ui/Textarea";
import type { RejectDialogProps } from "./RejectDialog.types";

export function RejectDialog({
  trigger,
  title = "Reject invoice?",
  description = "Explain what needs to be corrected before the contractor can resubmit.",
  reasonLabel = "Reason",
  reasonPlaceholder = "Explain what needs to be corrected before resubmission.",
  defaultReason = "",
  reason,
  onReasonChange,
  onReject,
  confirmLabel = "Reject invoice",
  cancelLabel = "Cancel",
  disabled,
  open,
  onOpenChange,
}: RejectDialogProps) {
  const [internalReason, setInternalReason] = useState(defaultReason);
  const currentReason = reason ?? internalReason;
  const canReject = currentReason.trim().length > 0 && !disabled;

  function setReason(nextReason: string) {
    setInternalReason(nextReason);
    onReasonChange?.(nextReason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="danger">
            Reject invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-destructive" aria-hidden="true" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field label={reasonLabel}>
          {({ id }) => (
            <Textarea
              id={id}
              value={currentReason}
              placeholder={reasonPlaceholder}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="button"
              variant="danger"
              disabled={!canReject}
              onClick={() => onReject?.(currentReason.trim())}
            >
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
