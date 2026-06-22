import { cn } from "@/src/lib/utils";
import type { FieldProps } from "./Field.types";

export function Field({ label, htmlFor, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={htmlFor} className="font-ui text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-cta">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="font-ui text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="font-ui text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
