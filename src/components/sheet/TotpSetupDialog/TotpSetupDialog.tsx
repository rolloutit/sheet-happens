"use client";

import { QrCode } from "lucide-react";
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
import { Input } from "@/src/components/ui/Input";
import type { TotpSetupDialogProps } from "./TotpSetupDialog.types";

export function TotpSetupDialog({
  trigger,
  title = "Set up authenticator app",
  description = "Scan the QR code with an authenticator app, then enter the 6 digit code.",
  secret = "SH-2026-DEMO",
  codeValue,
  codeLabel = "6 digit code",
  confirmLabel = "Verify",
  cancelLabel = "Cancel",
  confirmDisabled,
  onCodeChange,
  onConfirm,
  open,
  onOpenChange,
}: TotpSetupDialogProps) {
  const [localCode, setLocalCode] = useState("");
  const code = codeValue ?? localCode;
  const disabled = confirmDisabled ?? code.length < 6;

  function updateCode(value: string) {
    const nextCode = value.replace(/\D/g, "").slice(0, 6);
    setLocalCode(nextCode);
    onCodeChange?.(nextCode);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="cta">
            Enable TOTP
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary p-4">
            <span className="grid size-20 place-items-center rounded-[var(--radius-md)] bg-white text-slate-900">
              <QrCode className="size-10" aria-hidden="true" />
            </span>
            <div>
              <p className="font-ui text-sm font-semibold">Manual key</p>
              <p className="break-all text-sm text-muted-foreground">{secret}</p>
            </div>
          </div>
          <Field label={codeLabel}>
            {({ id }) => (
              <Input
                id={id}
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(event) => updateCode(event.target.value)}
              />
            )}
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button type="button" variant="cta" disabled={disabled} onClick={() => onConfirm?.(code)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
