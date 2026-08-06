"use client";

import { AlertTriangle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
import { cn } from "@/src/lib/utils";

import { submitTimesheetAction, type TimesheetActionState } from "./actions";

export type SubmitTimesheetButtonProps = {
  periodStart: string;
  disabled: boolean;
  disabledReason: string | null;
  labels: {
    trigger: string;
    title: string;
    description: string;
    details: string;
    confirm: string;
    cancel: string;
    submitting: string;
  };
};

export function SubmitTimesheetButton({
  periodStart,
  disabled,
  disabledReason,
  labels,
}: SubmitTimesheetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TimesheetActionState>({
    status: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await submitTimesheetAction({ periodStart });
      setState(result);

      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid justify-items-start gap-2 sm:justify-items-end">
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setState({
              status: "idle",
              message: "",
            });
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="cta"
            icon={Send}
            disabled={disabled}
            title={disabledReason ?? undefined}
          >
            {labels.trigger}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>
          <div className="rounded-[var(--radius-md)] bg-secondary p-3 text-sm text-muted-foreground">
            {labels.details}
          </div>
          {state.status === "error" ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/35 bg-destructive-soft px-3 py-2 text-sm leading-5 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{state.message}</span>
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                {labels.cancel}
              </Button>
            </DialogClose>
            <Button type="button" variant="cta" icon={Send} loading={isPending} onClick={submit}>
              {isPending ? labels.submitting : labels.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {disabledReason ? (
        <p className="max-w-sm text-left text-xs leading-5 text-muted-foreground sm:text-right">
          {disabledReason}
        </p>
      ) : null}
      {state.status !== "idle" ? (
        <p
          className={cn(
            "flex max-w-sm items-start gap-2 text-left text-xs leading-5 sm:text-right",
            state.status === "success" ? "text-success" : "text-destructive",
          )}
        >
          {state.status === "error" ? (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          <span>{state.message}</span>
        </p>
      ) : null}
    </div>
  );
}
