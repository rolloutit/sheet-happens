import { cn } from "@/src/lib/utils";
import type {
  TimesheetStepState,
  TimesheetStepperProps,
  TimesheetStepperStep,
} from "./TimesheetStepper.types";

const workflow = [
  { id: "created", label: "Created" },
  { id: "submitted", label: "Submitted" },
  { id: "approved", label: "Approved" },
  { id: "invoiced", label: "Invoiced" },
  { id: "paid", label: "Paid" },
] as const;

const statusIndex = {
  not_created: -1,
  submitted: 1,
  rejected: 1,
  approved: 2,
  invoiced: 3,
  invoice_rejected: 3,
  accepted: 3,
  paid: 4,
  missing: -1,
} as const;

function stateClass(state: TimesheetStepState) {
  return cn(
    state === "done" && "border-success bg-success text-success-foreground",
    state === "current" && "border-primary bg-accent-soft text-accent",
    state === "rejected" && "border-destructive bg-destructive-soft text-destructive",
    state === "locked" && "border-border bg-secondary text-muted-foreground",
    state === "todo" && "border-border bg-secondary text-muted-foreground",
  );
}

function getSteps(status: NonNullable<TimesheetStepperProps["status"]>): TimesheetStepperStep[] {
  const currentIndex = statusIndex[status];
  const rejected = status === "rejected" || status === "invoice_rejected";

  return workflow.map((step, index) => {
    let state: TimesheetStepState = "todo";
    if (index < currentIndex) state = "done";
    if (index === currentIndex) state = rejected ? "rejected" : "current";
    if (status === "paid" && index <= currentIndex) state = "done";
    if (currentIndex < 0 && index > 0) state = "locked";
    return { ...step, state };
  });
}

export function TimesheetStepper({
  status = "approved",
  steps = getSteps(status),
  "aria-label": ariaLabel = "Timesheet workflow",
  className,
}: TimesheetStepperProps) {
  return (
    <ol className={cn("grid grid-cols-5 gap-2", className)} aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <li key={step.id} className="grid justify-items-center gap-2 text-center">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full border font-ui text-sm font-semibold",
              stateClass(step.state),
            )}
            aria-current={
              step.state === "current" || step.state === "rejected" ? "step" : undefined
            }
          >
            {index + 1}
          </span>
          <span className="text-xs text-muted-foreground">{step.label}</span>
          {step.description ? (
            <span className="sr-only">
              {step.state}: {step.description}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
