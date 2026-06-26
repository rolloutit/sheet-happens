import { cn } from "@/src/lib/utils";
import type { FormMessageProps } from "./FormMessage.types";

export function FormMessage({ tone = "hint", className, ...props }: FormMessageProps) {
  return (
    <p
      {...props}
      className={cn(
        "font-ui text-xs",
        tone === "hint" && "text-muted-foreground",
        tone === "error" && "font-medium text-destructive",
        tone === "success" && "font-medium text-success",
        className,
      )}
      role={tone === "error" ? "alert" : props.role}
      aria-live={tone === "error" ? "polite" : props["aria-live"]}
    />
  );
}
