import { CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type {
  PasswordStrengthResult,
  StrengthMeterLabels,
  StrengthMeterProps,
  StrengthMeterScore,
  StrengthRequirement,
} from "./StrengthMeter.types";

const defaultLabels = {
  0: "Very weak",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
} satisfies Record<StrengthMeterScore, string>;

const segmentClasses = {
  0: "bg-secondary",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-primary",
  4: "bg-success",
} satisfies Record<StrengthMeterScore, string>;

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements: StrengthRequirement[] = [
    { id: "length", label: "At least 12 characters", met: password.length >= 12 },
    {
      id: "case",
      label: "Upper and lower case",
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { id: "number", label: "Number included", met: /\d/.test(password) },
    { id: "symbol", label: "Symbol included", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const metCount = requirements.filter((requirement) => requirement.met).length;
  const score = Math.min(4, metCount) as StrengthMeterScore;

  return { score, requirements };
}

function getLabel(labels: StrengthMeterLabels | undefined, score: StrengthMeterScore) {
  return labels?.[score] ?? defaultLabels[score];
}

export function StrengthMeter({
  score,
  label = "Password strength",
  helperText,
  labels,
  requirements,
  className,
  ...props
}: StrengthMeterProps) {
  const resolvedLabel = getLabel(labels, score);

  return (
    <div className={cn("grid gap-2", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-ui text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-ui text-xs font-semibold text-foreground">{resolvedLabel}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={resolvedLabel}
        className="grid grid-cols-4 gap-1"
      >
        {([1, 2, 3, 4] as const).map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-2 rounded-full bg-secondary",
              score >= segment && segmentClasses[score],
            )}
          />
        ))}
      </div>
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {requirements ? (
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          {requirements.map((requirement) => {
            const Icon = requirement.met ? CheckCircle2 : Circle;
            return (
              <li key={requirement.id} className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-4",
                    requirement.met ? "text-success" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className={requirement.met ? "text-foreground" : undefined}>
                  {requirement.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
