import { CheckCircle2, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { cn } from "@/src/lib/utils";
import { StatusPill } from "../StatusPill";
import type { ReviewDiffItem, ReviewDiffListProps, ReviewDiffTotal } from "./ReviewDiffList.types";

function totalClasses(tone: ReviewDiffTotal["tone"]) {
  if (tone === "warning") return "border-warning/35 bg-warning/10";
  if (tone === "danger") return "border-destructive/35 bg-destructive/10";
  if (tone === "success") return "border-success/30 bg-success/10";
  return "border-border bg-secondary";
}

function DiffBadge({ state, label, delta }: Pick<ReviewDiffItem, "state" | "label" | "delta">) {
  const Icon = state === "match" ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-lg)] border p-3",
        state === "match"
          ? "border-success/30 bg-success/10"
          : "border-destructive/35 bg-destructive/10",
      )}
    >
      <Icon
        className={cn("size-5", state === "match" ? "text-success" : "text-destructive")}
        aria-hidden="true"
      />
      <div>
        <p className="font-ui text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{delta}</p>
      </div>
    </div>
  );
}

export function ReviewDiffList({
  title = "Invoice diff",
  description = "Compare submitted timesheet totals with uploaded invoice.",
  status = "invoiced",
  items,
  totals = [],
  footer,
  className,
}: ReviewDiffListProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <StatusPill status={status} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {items.map((item) => (
            <DiffBadge key={item.id} state={item.state} label={item.label} delta={item.delta} />
          ))}
        </div>
        {totals.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {totals.map((total) => (
              <div
                key={total.id}
                className={cn("rounded-[var(--radius-lg)] border p-4", totalClasses(total.tone))}
              >
                <p className="font-ui text-sm font-semibold">{total.label}</p>
                <p className="mt-3 text-2xl font-semibold">{total.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
