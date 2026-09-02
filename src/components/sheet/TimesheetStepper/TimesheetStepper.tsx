"use client";

import { Check, LockKeyhole, X } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";
import { cn } from "@/src/lib/utils";
import type {
  TimesheetStepState,
  TimesheetStepperProps,
  TimesheetStepperStep,
  TimesheetWorkflowStepId,
} from "./TimesheetStepper.types";

const workflow: Array<{ id: TimesheetWorkflowStepId; label: string }> = [
  { id: "created", label: "Assembled" },
  { id: "submitted", label: "Submitted" },
  { id: "approved", label: "Approved" },
  { id: "invoiced", label: "Invoice" },
  { id: "paid", label: "Paid" },
];

function stateClass(state: TimesheetStepState) {
  return cn(
    state === "done" && "border-success bg-success text-success-foreground",
    state === "current" && "border-primary bg-accent-soft text-accent",
    state === "rejected" && "border-destructive bg-destructive-soft text-destructive-bright",
    state === "locked" && "border-border bg-secondary text-muted-foreground",
    state === "todo" && "border-border bg-secondary text-muted-foreground",
  );
}

function getWorkflowStates(
  status: NonNullable<TimesheetStepperProps["status"]>,
): TimesheetStepState[] {
  switch (status) {
    case "submitted":
      return ["done", "current", "locked", "locked", "locked"];
    case "rejected":
      return ["done", "rejected", "locked", "locked", "locked"];
    case "approved":
      return ["done", "done", "current", "locked", "locked"];
    case "invoiced":
      return ["done", "done", "done", "current", "locked"];
    case "invoice_rejected":
      return ["done", "done", "done", "rejected", "locked"];
    case "accepted":
      return ["done", "done", "done", "done", "current"];
    case "paid":
      return ["done", "done", "done", "done", "done"];
    case "not_created":
    case "missing":
      return ["current", "locked", "locked", "locked", "locked"];
  }
}

function getSteps(
  status: NonNullable<TimesheetStepperProps["status"]>,
  labels: TimesheetStepperProps["labels"],
  lockedDescriptions: TimesheetStepperProps["lockedDescriptions"],
): TimesheetStepperStep[] {
  const states = getWorkflowStates(status);

  return workflow.map((step, index) => ({
    ...step,
    label: labels?.[step.id] ?? step.label,
    state: states[index],
    description: lockedDescriptions?.[step.id],
  }));
}

function StepMarker({ state, index }: { state: TimesheetStepState; index: number }) {
  if (state === "done") return <Check className="size-4" aria-hidden="true" />;
  if (state === "rejected") return <X className="size-4" aria-hidden="true" />;
  if (state === "locked") return <LockKeyhole className="size-3.5" aria-hidden="true" />;

  return index + 1;
}

export function TimesheetStepper({
  status = "approved",
  steps,
  labels,
  lockedDescriptions,
  "aria-label": ariaLabel = "Timesheet workflow",
  className,
}: TimesheetStepperProps) {
  const resolvedSteps = steps ?? getSteps(status, labels, lockedDescriptions);

  return (
    <TooltipProvider delayDuration={250}>
      <div className={cn("overflow-x-auto", className)}>
        <ol
          className="grid min-w-[32rem] py-1"
          style={{ gridTemplateColumns: `repeat(${resolvedSteps.length}, minmax(5.5rem, 1fr))` }}
          aria-label={ariaLabel}
        >
          {resolvedSteps.map((step, index) => {
            const marker = (
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 font-ui text-sm font-semibold",
                  stateClass(step.state),
                  step.state === "locked" && step.description && "cursor-help",
                )}
                data-step-state={step.state}
                aria-current={
                  step.state === "current" || step.state === "rejected" ? "step" : undefined
                }
              >
                <StepMarker state={step.state} index={index} />
              </span>
            );

            return (
              <li
                key={step.id}
                className="relative grid min-w-0 justify-items-center gap-2 text-center"
              >
                {index < resolvedSteps.length - 1 ? (
                  <span
                    className={cn(
                      "absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-[1.0625rem] h-0.5 rounded-full",
                      resolvedSteps[index + 1]?.state === "done" ? "bg-accent" : "bg-border",
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                {step.state === "locked" && step.description ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="relative z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={`${String(step.label)}: ${String(step.description)}`}
                      >
                        {marker}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{step.description}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="relative z-10">{marker}</span>
                )}
                <span
                  className={cn(
                    "px-1 font-ui text-xs font-semibold leading-tight text-muted-foreground",
                    step.state === "current" && "text-accent",
                    step.state === "rejected" && "text-destructive",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </TooltipProvider>
  );
}
