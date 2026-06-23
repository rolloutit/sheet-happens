import { cn } from "@/src/lib/utils";
import type { SectionHeadProps } from "./SectionHead.types";

export function SectionHead({ eyebrow, title, subtitle, actions, className }: SectionHeadProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="grid gap-1">
        {eyebrow ? (
          <p className="font-ui text-xs font-semibold uppercase text-accent">{eyebrow}</p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
