import { useId } from "react";

import { cn } from "@/src/lib/utils";
import { FormMessage } from "../FormMessage";
import type { FieldProps } from "./Field.types";

export function Field({
  id,
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? htmlFor ?? `field-${generatedId}`;
  const hintId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = errorId ?? hintId;
  const invalid = Boolean(error);

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={controlId} className="font-ui text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-cta">*</span> : null}
      </label>
      {typeof children === "function"
        ? children({ id: controlId, describedBy, invalid, required })
        : children}
      {error ? (
        <FormMessage id={errorId} tone="error">
          {error}
        </FormMessage>
      ) : hint ? (
        <FormMessage id={hintId} tone="hint">
          {hint}
        </FormMessage>
      ) : null}
    </div>
  );
}
