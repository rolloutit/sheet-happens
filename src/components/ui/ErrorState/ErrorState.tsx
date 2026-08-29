import { AlertTriangle } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { ErrorStateProps } from "./ErrorState.types";

export function ErrorState({
  title,
  message,
  code,
  icon: Icon = AlertTriangle,
  action,
  tone = "error",
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-4 rounded-[var(--radius-xl)] border p-8 text-center",
        tone === "error" && "border-destructive/45 bg-destructive-soft",
        tone === "warning" && "border-warning/35 bg-warning-soft",
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-background/40">
        <Icon
          className={cn("size-6", tone === "error" ? "text-destructive-bright" : "text-warning")}
          aria-hidden="true"
        />
      </span>
      <div className="grid gap-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
        {code ? (
          <p className="font-ui text-xs font-semibold text-muted-foreground">{code}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
